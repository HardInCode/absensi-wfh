# Fase 2: Attendance & Upload Foto (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Buat setiap file baru pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya, lalu terapkan edit pada file Fase 1. Buat folder yang belum ada. Fase 1 sudah terpasang.

---

## Keputusan desain & asumsi (penting dipahami sebelum mengimplementasikan)

- **Waktu absen selalu dari server.** Client tidak bisa mengirim `checkInAt`. Milidetik dibuang (`setMilliseconds(0)`) agar konsisten dengan `DATETIME` MySQL dan tidak ada pembulatan yang menggeser tanggal di tengah malam.
- **Satu absen per hari.** Dijaga dua lapis: pengecekan `count` di service, dan `UNIQUE (employee_id, attendance_date)` di DB sebagai pengaman race condition (error `ER_DUP_ENTRY` diubah menjadi 409). `attendance_date` dihitung menurut zona waktu WIB (Asia/Jakarta), bukan UTC.
- **Validasi foto berlapis.** `fileFilter` mengecek mimetype, batas ukuran 3 MB via multer, lalu isi file dicek lewat magic bytes karena header Content-Type mudah dipalsukan. Upload memakai `memoryStorage`. File baru ditulis ke disk hanya setelah validasi dan cek duplikat lolos, dan dihapus lagi jika insert DB gagal (tidak ada file yatim).
- **Nama file dibuat ulang.** Format `<uuid>.<ext>`; nama asli dari client diabaikan (mencegah path traversal dan tabrakan nama).
- **`photo_path` hanya menyimpan nama file**, relatif ke `backend/uploads/`. Kolom ini di-`@Exclude()`; client menerima `photoUrl` (`/api/attendances/:id/photo`).
- **Akses foto.** Hanya pemilik atau ADMIN_HRD. Akses foto orang lain menghasilkan 403 (bukan 404). `basename()` dipakai saat membaca file sebagai pertahanan tambahan. Response memakai `Cache-Control: private, no-store`.
- **Foto di frontend (Fase 3).** Endpoint foto butuh header Authorization, jadi `<img src>` langsung tidak bisa. Ambil lewat Axios dengan `responseType: 'blob'`, lalu pakai `URL.createObjectURL`. Ini juga aman terhadap helmet (CORP `same-origin`).
- **Format waktu.** `checkInAt` dikirim sebagai ISO UTC, sedangkan `attendanceDate` sudah menurut WIB. Frontend perlu memformat `checkInAt` ke `Asia/Jakarta`.
- **Role.** `POST /attendances` dan `GET /attendances/me` khusus EMPLOYEE (ADMIN_HRD mencoba absen akan 403). `GET /attendances` khusus ADMIN_HRD dengan filter `date_from`, `date_to`, `employee_name` dan paginasi. `date_from` tidak boleh lebih besar dari `date_to` (400).
- **`GET /attendances/me`** hanya punya paginasi `page` dan `limit`, tanpa filter tanggal.
- **Folder `uploads/`** adalah folder lokal biasa karena di Docker Compose Fase 1 hanya MySQL yang di-container. Jika backend nanti dikontainerisasi, mount folder itu sebagai volume.
- **Asumsi dari Fase 1:** `@Roles(...)` menerima varargs (`@Roles(Role.EMPLOYEE, Role.ADMIN_HRD)`), dan `PaginationQueryDto` punya `page` dan `limit` bertipe number dengan default. Keduanya sudah sesuai kode Fase 1.

---

## 0. Dependensi tambahan

```bash
cd absensi-wfh/backend
npm i -D @types/multer
```

---

## 1. File baru

### `absensi-wfh/backend/src/attendances/attendances.constants.ts`
```ts
import { resolve } from 'path';

export const UPLOAD_DIR = resolve(process.cwd(), 'uploads');

export const MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
```

### `absensi-wfh/backend/src/attendances/utils/date.util.ts`
```ts
import { APP_TIMEZONE } from '../../common/constants/app.constants';

const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Mengembalikan tanggal (YYYY-MM-DD) menurut zona waktu Asia/Jakarta.
 * Locale en-CA menghasilkan format ISO YYYY-MM-DD.
 */
export function toJakartaDateString(date: Date): string {
  return jakartaDateFormatter.format(date);
}
```

### `absensi-wfh/backend/src/attendances/utils/image-type.util.ts`
```ts
export type ImageExt = 'jpg' | 'png' | 'webp';

export interface DetectedImage {
  ext: ImageExt;
  mime: string;
}

export const MIME_BY_EXT: Record<ImageExt, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * Deteksi tipe gambar dari magic bytes (isi file), bukan dari header
 * Content-Type atau nama file yang bisa dipalsukan client.
 */
export function detectImageType(buffer: Buffer): DetectedImage | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { ext: 'jpg', mime: MIME_BY_EXT.jpg };
  }

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ext: 'png', mime: MIME_BY_EXT.png };
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', mime: MIME_BY_EXT.webp };
  }

  return null;
}
```

### `absensi-wfh/backend/src/attendances/entities/attendance.entity.ts`
```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('attendances')
@Unique('uq_attendance_employee_date', ['employeeId', 'attendanceDate'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employeeId: string;

  @ManyToOne(() => Employee, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'check_in_at', type: 'datetime' })
  checkInAt: Date;

  // Tipe DATE di MySQL -> dibaca TypeORM sebagai string 'YYYY-MM-DD'
  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  // Hanya nama file (UUID.ext) relatif terhadap folder uploads/. Tidak dikirim ke client.
  @Exclude()
  @Column({ name: 'photo_path', type: 'varchar', length: 255 })
  photoPath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### `absensi-wfh/backend/src/attendances/dto/create-attendance.dto.ts`
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAttendanceDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'Bekerja dari rumah' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### `absensi-wfh/backend/src/attendances/dto/query-attendance.dto.ts`
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QueryAttendanceDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01', description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_from harus berformat YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'date_from bukan tanggal yang valid' })
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_to harus berformat YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'date_to bukan tanggal yang valid' })
  date_to?: string;

  @ApiPropertyOptional({ example: 'budi', description: 'Pencarian sebagian nama karyawan' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  employee_name?: string;
}
```

### `absensi-wfh/backend/src/attendances/dto/attendance-response.dto.ts`
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceEmployeeSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() position: string;
}

export class AttendanceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ description: 'ISO 8601 (UTC). Tampilkan dalam WIB di frontend.' })
  checkInAt: string;
  @ApiProperty({ example: '2026-11-03', description: 'Tanggal absen menurut WIB' })
  attendanceDate: string;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty({ example: '/api/attendances/<id>/photo' }) photoUrl: string;
  @ApiPropertyOptional({ type: AttendanceEmployeeSummaryDto })
  employee?: AttendanceEmployeeSummaryDto;
}

class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedAttendanceResponseDto {
  @ApiProperty({ type: [AttendanceResponseDto] }) data: AttendanceResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
```

### `absensi-wfh/backend/src/attendances/attendances.service.ts`
```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { createReadStream, ReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { Attendance } from './entities/attendance.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Role } from '../common/enums/role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { UPLOAD_DIR } from './attendances.constants';
import { toJakartaDateString } from './utils/date.util';
import {
  detectImageType,
  ImageExt,
  MIME_BY_EXT,
} from './utils/image-type.util';

export interface AttendanceView {
  id: string;
  employeeId: string;
  checkInAt: Date;
  attendanceDate: string;
  notes: string | null;
  createdAt: Date;
  photoUrl: string;
  employee?: Employee;
}

export interface PhotoStream {
  stream: ReadStream;
  mime: string;
  size: number;
}

const ALREADY_CHECKED_IN_MESSAGE = 'Anda sudah melakukan absen hari ini';

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
  ) {}

  async create(
    employee: Employee,
    file: Express.Multer.File | undefined,
    dto: CreateAttendanceDto,
  ): Promise<AttendanceView> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Foto bukti wajib diunggah (field: photo)');
    }

    // Validasi isi file (magic bytes), bukan hanya mimetype dari client.
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        'File harus berupa gambar JPG, PNG, atau WEBP yang valid',
      );
    }

    // Waktu SELALU dari server. Milidetik dibuang agar konsisten dengan DATETIME MySQL
    // (menghindari pembulatan yang bisa menggeser tanggal di tengah malam).
    const checkInAt = new Date();
    checkInAt.setMilliseconds(0);
    const attendanceDate = toJakartaDateString(checkInAt);

    const alreadyCheckedIn = await this.attendanceRepo.count({
      where: { employeeId: employee.id, attendanceDate },
    });
    if (alreadyCheckedIn > 0) {
      throw new ConflictException(ALREADY_CHECKED_IN_MESSAGE);
    }

    // Nama file dibuat ulang (UUID); nama asli dari client diabaikan.
    const filename = `${randomUUID()}.${detected.ext}`;
    const fullPath = join(UPLOAD_DIR, filename);

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(fullPath, file.buffer, { flag: 'wx' });

    try {
      const entity = this.attendanceRepo.create({
        employeeId: employee.id,
        checkInAt,
        attendanceDate,
        photoPath: filename,
        notes: dto.notes ? dto.notes : null,
      });
      const saved = await this.attendanceRepo.save(entity);
      return this.toView(saved);
    } catch (error) {
      // Rollback file agar tidak ada file yatim.
      await unlink(fullPath).catch(() => undefined);

      // Race condition: dua request bersamaan lolos pengecekan, dicegah oleh UNIQUE constraint.
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(ALREADY_CHECKED_IN_MESSAGE);
      }
      throw error;
    }
  }

  async findMine(
    employee: Employee,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<AttendanceView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [rows, total] = await this.attendanceRepo.findAndCount({
      where: { employeeId: employee.id },
      order: { checkInAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((row) => this.toView(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(
    query: QueryAttendanceDto,
  ): Promise<PaginatedResult<AttendanceView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    if (query.date_from && query.date_to && query.date_from > query.date_to) {
      throw new BadRequestException(
        'date_from tidak boleh lebih besar dari date_to',
      );
    }

    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoin('a.employee', 'e')
      .addSelect(['e.id', 'e.nik', 'e.fullName', 'e.email', 'e.position']);

    if (query.date_from) {
      qb.andWhere('a.attendanceDate >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      qb.andWhere('a.attendanceDate <= :dateTo', { dateTo: query.date_to });
    }
    if (query.employee_name) {
      const escaped = query.employee_name.replace(/[\\%_]/g, '\\$&');
      qb.andWhere('e.fullName LIKE :name', { name: `%${escaped}%` });
    }

    qb.orderBy('a.checkInAt', 'DESC')
      .addOrderBy('a.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((row) => this.toView(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPhoto(id: string, user: Employee): Promise<PhotoStream> {
    const attendance = await this.attendanceRepo.findOne({ where: { id } });
    if (!attendance) {
      throw new NotFoundException('Data absensi tidak ditemukan');
    }

    const isOwner = attendance.employeeId === user.id;
    const isAdmin = user.role === Role.ADMIN_HRD;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Anda tidak berhak mengakses foto ini');
    }

    // basename() mencegah path traversal seandainya photo_path pernah termanipulasi.
    const filename = basename(attendance.photoPath);
    const fullPath = join(UPLOAD_DIR, filename);

    let size: number;
    try {
      const fileStat = await stat(fullPath);
      if (!fileStat.isFile()) throw new Error('not a file');
      size = fileStat.size;
    } catch {
      throw new NotFoundException('File foto tidak ditemukan di server');
    }

    const ext = extname(filename).slice(1).toLowerCase() as ImageExt;
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';

    return { stream: createReadStream(fullPath), mime, size };
  }

  private toView(attendance: Attendance): AttendanceView {
    return {
      id: attendance.id,
      employeeId: attendance.employeeId,
      checkInAt: attendance.checkInAt,
      attendanceDate: attendance.attendanceDate,
      notes: attendance.notes,
      createdAt: attendance.createdAt,
      photoUrl: `/api/attendances/${attendance.id}/photo`,
      ...(attendance.employee ? { employee: attendance.employee } : {}),
    };
  }
}
```

### `absensi-wfh/backend/src/attendances/attendances.controller.ts`
```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AttendancesService } from './attendances.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import {
  AttendanceResponseDto,
  PaginatedAttendanceResponseDto,
} from './dto/attendance-response.dto';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
} from './attendances.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { Employee } from '../employees/entities/employee.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('attendances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'JPG/PNG/WEBP, maks 3 MB' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_SIZE_BYTES, files: 1 },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Foto harus berformat JPG, PNG, atau WEBP'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  create(
    @CurrentUser() user: Employee,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendancesService.create(user, photo, dto);
  }

  @Get('me')
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: PaginatedAttendanceResponseDto })
  findMine(
    @CurrentUser() user: Employee,
    @Query() query: PaginationQueryDto,
  ) {
    return this.attendancesService.findMine(user, query);
  }

  @Get()
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: PaginatedAttendanceResponseDto })
  findAll(@Query() query: QueryAttendanceDto) {
    return this.attendancesService.findAll(query);
  }

  @Get(':id/photo')
  @Roles(Role.EMPLOYEE, Role.ADMIN_HRD)
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary gambar bukti absen' })
  async getPhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: Employee,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mime, size } = await this.attendancesService.getPhoto(id, user);

    res.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
    });

    return new StreamableFile(stream, { type: mime, length: size });
  }
}
```

### `absensi-wfh/backend/src/attendances/attendances.module.ts`
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './entities/attendance.entity';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance])],
  controllers: [AttendancesController],
  providers: [AttendancesService],
})
export class AttendancesModule {}
```

### `absensi-wfh/backend/uploads/.gitkeep`
```text
(file kosong; buat file ini agar folder uploads/ ikut ter-commit)
```

---

## 2. Edit file Fase 1

### `absensi-wfh/backend/src/app.module.ts` (ganti seluruh isi dengan ini)
```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthModule } from './auth/auth.module';
import { AttendancesModule } from './attendances/attendances.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    EmployeesModule,
    AuthModule,
    AttendancesModule,
  ],
})
export class AppModule {}
```

### `absensi-wfh/backend/src/database/database.module.ts`
Tidak perlu diubah. Fase 1 sudah memakai `autoLoadEntities: true` dan `timezone: APP_UTC_OFFSET`, jadi entity `Attendance` otomatis terdaftar lewat `TypeOrmModule.forFeature([Attendance])`.

---

## Cara menjalankan

```bash
# root: pastikan MySQL jalan
docker compose up -d

cd backend
npm i -D @types/multer
npm run start:dev      # DB_SYNCHRONIZE=true akan membuat tabel attendances otomatis
```

Swagger: http://localhost:3000/api/docs

## Cara mengetes

Siapkan sebuah `test.jpg` asli (< 3 MB).

```bash
API=http://localhost:3000/api

BUDI=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"budi@company.test","password":"Karyawan123!"}' | jq -r .accessToken)
ADMIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@company.test","password":"Admin123!"}' | jq -r .accessToken)

# 1) Absen sukses (201), waktu dari server
curl -s -X POST $API/attendances -H "Authorization: Bearer $BUDI" \
  -F "photo=@test.jpg" -F "notes=WFH hari ini" | jq

# 2) Absen kedua di hari yang sama -> 409
curl -s -X POST $API/attendances -H "Authorization: Bearer $BUDI" -F "photo=@test.jpg" | jq

# 3) Riwayat sendiri
curl -s "$API/attendances/me?page=1&limit=10" -H "Authorization: Bearer $BUDI" | jq

# 4) HRD melihat semua + filter
curl -s "$API/attendances?date_from=2026-11-01&date_to=2026-11-30&employee_name=bud&page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN" | jq

# 5) Ambil foto (ganti <ID> dengan id absensi) -> 200 untuk Budi dan Admin
curl -s -o out.jpg -w "%{http_code}\n" $API/attendances/<ID>/photo -H "Authorization: Bearer $BUDI"
curl -s -o out.jpg -w "%{http_code}\n" $API/attendances/<ID>/photo -H "Authorization: Bearer $ADMIN"

# 6) Tanpa token -> 401
curl -s -o /dev/null -w "%{http_code}\n" $API/attendances/<ID>/photo

# 7) ADMIN mencoba absen -> 403 ; EMPLOYEE membuka GET /attendances -> 403
curl -s -X POST $API/attendances -H "Authorization: Bearer $ADMIN" -F "photo=@test.jpg" | jq
curl -s $API/attendances -H "Authorization: Bearer $BUDI" | jq

# 8) File palsu (isi teks, diberi nama .jpg dan Content-Type image/jpeg) -> 400
echo "bukan gambar" > fake.jpg
curl -s -X POST $API/attendances -H "Authorization: Bearer $BUDI" -F "photo=@fake.jpg;type=image/jpeg" | jq

# 9) File > 3 MB -> 413
head -c 4000000 /dev/urandom > big.jpg
curl -s -X POST $API/attendances -H "Authorization: Bearer $BUDI" -F "photo=@big.jpg;type=image/jpeg" | jq

# 10) Format tidak diizinkan (mis. .gif / .pdf) -> 400
```

Pengujian tambahan:

- **Foto milik orang lain:** buat karyawan kedua lewat `POST /api/employees`, login sebagai dia, lalu akses foto Budi. Hasilnya harus 403.
- **Cek folder:** `backend/uploads/` hanya berisi `<uuid>.jpg` dan tidak ada file untuk request yang gagal.
- **Cek DB:** `attendance_date` harus sama dengan tanggal WIB dari `check_in_at`.
- **Waktu dari server:** menambahkan field `checkInAt` di body tidak berpengaruh, dan akan ditolak 400 karena `forbidNonWhitelisted`.
