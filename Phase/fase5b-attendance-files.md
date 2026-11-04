# Fase 5B: attendance-service + Endpoint Absensi di Gateway (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Fase 5A (`fase5-microservices-files.md`) sudah terpasang dan lulus tes. Fase ini menambah `attendance-service` (TCP :3002), memindahkan upload dan streaming foto ke `api-gateway`, menambah dua pattern RPC di `employee-service` (untuk filter nama dan pengayaan nama/NIK), dan memulihkan endpoint `/api/attendances*`. Buat setiap file pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya. File yang sudah ada dan disebut di bagian 1 sampai 5 ditimpa penuh. Buat folder yang belum ada.

Catatan penting:
- Semua path relatif terhadap `absensi-wfh/backend/` kecuali disebut lain.
- Tidak ada dependensi npm baru (`multer` ikut `@nestjs/platform-express`, `@types/multer` sudah ada dari 5A).
- Kode ditulis tanpa dijalankan. Setelah semua file dibuat, jalankan `npm run typecheck`, perbaiki error compile bila ada tanpa mengubah perilaku yang dijelaskan di sini, lalu uji dengan bagian 8.
- **Penyesuaian kompatibilitas frontend.** Dokumen sumber 5B memakai kontrak `/attendances/today`, `/attendances/my`, query `dateFrom`/`dateTo`/`search`, dan respons tanpa `checkInAt`. Frontend Fase 3 dan 4 memakai `/attendances/me`, query `date_from`/`date_to`/`employee_name`, dan membaca `checkInAt`. Agar frontend tidak rusak, empat file (`attendance.mapper.ts`, `dto/attendance.dto.ts`, `attendances.service.ts`, `attendances.controller.ts`) ditambah alias. Setiap tambahan ditandai komentar `// KOMPAT FRONTEND`. Kontrak sumber tetap berlaku utuh, alias hanya tambahan.

Alur utama:
1. Gateway memvalidasi JWT dan role, lalu menerima multipart dan memeriksa magic bytes.
2. Gateway menulis file ke `uploads/{uuid}.ext`.
3. Gateway mengirim `{employeeId, photoPath, notes}` lewat TCP. Buffer tidak pernah lewat TCP.
4. attendance-service membuat `checkInAt` dan `attendanceDate` (WIB) lalu menyimpan ke DB.
5. Jika langkah 4 gagal pasti (409, 4xx, 5xx), gateway menghapus file yang sudah ditulis.

---

## 1. Perubahan `libs/common`

### `absensi-wfh/backend/libs/common/src/constants/rpc.constants.ts` (timpa penuh)
```ts
export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';
export const ATTENDANCE_SERVICE = 'ATTENDANCE_SERVICE';

export const EmployeePattern = {
  AUTH_LOGIN: 'auth.login',
  AUTH_VALIDATE: 'auth.validate',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_FIND_ALL: 'employees.findAll',
  EMPLOYEES_FIND_ONE: 'employees.findOne',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_REMOVE: 'employees.remove',
  EMPLOYEES_SEARCH_IDS: 'employees.searchIds',
  EMPLOYEES_FIND_BRIEFS: 'employees.findBriefs',
} as const;

export const AttendancePattern = {
  CREATE: 'attendances.create',
  FIND_TODAY: 'attendances.findToday',
  FIND_ALL: 'attendances.findAll',
  FIND_ONE: 'attendances.findOne',
} as const;

export const TIMEZONE = 'Asia/Jakarta';
```

### `absensi-wfh/backend/libs/common/src/interfaces/attendance.interface.ts` (baru)
```ts
/** Bentuk data antar-service. photoPath bersifat internal, tidak boleh bocor ke klien. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD (WIB)
  checkInAt: Date | string;
  createdAt: Date | string;
  photoPath: string;
  notes: string | null;
}

export interface CreateAttendancePayload {
  employeeId: string;
  photoPath: string;
  notes?: string | null;
}

/** Dipakai oleh /attendances (HRD) dan /attendances/my (employeeIds = [id dari token]). */
export interface ListAttendancesPayload {
  page: number;
  limit: number;
  employeeIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}
```

### `absensi-wfh/backend/libs/common/src/interfaces/employee.interface.ts` (timpa penuh)
```ts
import { Role } from '../enums/role.enum';

export interface EmployeeView {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Data ringkas untuk memperkaya daftar absensi. */
export interface EmployeeBrief {
  id: string;
  nik: string;
  fullName: string;
}
```

### `absensi-wfh/backend/libs/common/src/utils/wib.util.ts` (timpa penuh)
```ts
import { TIMEZONE } from '../constants/rpc.constants';

function wibParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Waktu WIB ISO 8601 dengan offset, mis. 2026-11-04T10:15:30+07:00. */
export function formatWibIso(date: Date = new Date()): string {
  const p = wibParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+07:00`;
}

/** Tanggal kalender WIB (YYYY-MM-DD). Dasar untuk attendance_date. */
export function wibDateString(date: Date = new Date()): string {
  const p = wibParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}
```

### `absensi-wfh/backend/libs/common/src/config/env.validation.ts` (timpa penuh)
attendance-service tidak butuh `JWT_SECRET`, dan gateway tidak butuh DB, jadi env dipisah.
```ts
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class BaseEnv {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';
}

class DbEnv extends BaseEnv {
  @IsString() @IsNotEmpty() DB_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) DB_PORT: number = 3306;
  @IsString() @IsNotEmpty() DB_NAME: string;
  @IsString() @IsNotEmpty() DB_USER: string;
  @IsString() @IsNotEmpty() DB_PASSWORD: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean = false;
}

export class GatewayEnv extends BaseEnv {
  @IsString() @MinLength(32) JWT_SECRET: string;

  @IsString() @IsNotEmpty() EMPLOYEE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) EMPLOYEE_SERVICE_PORT: number = 3001;
  @IsString() @IsNotEmpty() ATTENDANCE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) ATTENDANCE_SERVICE_PORT: number = 3002;

  @IsInt() @Min(1) @Max(65535) GATEWAY_PORT: number = 3000;
  @IsString() @IsNotEmpty() FRONTEND_URL: string = 'http://localhost:5173';
  @IsInt() @Min(100) RPC_TIMEOUT_MS: number = 5000;
  @IsString() @IsNotEmpty() UPLOAD_DIR: string = './uploads';
}

export class EmployeeServiceEnv extends DbEnv {
  @IsString() @MinLength(32) JWT_SECRET: string;
  @IsString() @IsNotEmpty() EMPLOYEE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) EMPLOYEE_SERVICE_PORT: number = 3001;
  @IsInt() @Min(60) JWT_EXPIRES_IN_SECONDS: number = 28800;
  @IsInt() @Min(4) @Max(15) BCRYPT_ROUNDS: number = 10;
}

export class AttendanceServiceEnv extends DbEnv {
  @IsString() @IsNotEmpty() ATTENDANCE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) ATTENDANCE_SERVICE_PORT: number = 3002;
}

function createEnvValidator<T extends object>(cls: new () => T) {
  return (config: Record<string, unknown>): T => {
    const validated = plainToInstance(cls, config, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });
    const errors = validateSync(validated);
    if (errors.length > 0) {
      const detail = errors
        .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n');
      throw new Error(`Konfigurasi environment tidak valid:\n${detail}`);
    }
    return validated;
  };
}

export const validateGatewayEnv = createEnvValidator(GatewayEnv);
export const validateEmployeeServiceEnv = createEnvValidator(EmployeeServiceEnv);
export const validateAttendanceServiceEnv = createEnvValidator(AttendanceServiceEnv);
```

### `absensi-wfh/backend/libs/common/src/index.ts` (timpa penuh)
```ts
export * from './enums/role.enum';
export * from './constants/rpc.constants';
export * from './interfaces/auth.interface';
export * from './interfaces/employee.interface';
export * from './interfaces/attendance.interface';
export * from './dto/auth.dto';
export * from './dto/employee.dto';
export * from './rpc/rpc-error';
export * from './rpc/rpc-exception.filter';
export * from './rpc/send-rpc';
export * from './config/env.validation';
export * from './database/typeorm.config';
export * from './utils/wib.util';
```

---

## 2. employee-service: dua pattern baru (untuk filter nama dan pengayaan)

### `absensi-wfh/backend/apps/employee-service/src/employees/employees.service.ts` (timpa penuh)
Perubahan dari 5A: import `In` dan `EmployeeBrief`, serta dua method baru `searchIds` dan `findBriefsByIds` setelah `findEntityOrNull`.
```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Brackets, FindOptionsWhere, In, QueryFailedError, Repository } from 'typeorm';
import {
  CreateEmployeeDto,
  EmployeeBrief,
  EmployeeView,
  PaginatedResult,
  QueryEmployeesDto,
  UpdateEmployeeDto,
} from '@app/common';
import { toEmployeeView } from './employee.mapper';
import { Employee } from './entities/employee.entity';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    private readonly config: ConfigService,
  ) {}

  private get rounds(): number {
    return this.config.getOrThrow<number>('BCRYPT_ROUNDS');
  }

  async create(dto: CreateEmployeeDto): Promise<EmployeeView> {
    const nik = dto.nik.trim();
    const email = dto.email.trim().toLowerCase();
    await this.assertUnique({ nik, email });

    const passwordHash = await bcrypt.hash(dto.password, this.rounds);
    try {
      const saved = await this.repo.save(
        this.repo.create({
          nik,
          fullName: dto.fullName,
          email,
          passwordHash,
          position: dto.position,
          role: dto.role,
          isActive: dto.isActive ?? true,
        }),
      );
      return toEmployeeView(saved);
    } catch (e) {
      throw this.translateDbError(e);
    }
  }

  async findAll(query: QueryEmployeesDto): Promise<PaginatedResult<EmployeeView>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const qb = this.repo.createQueryBuilder('e');
    if (query.search) {
      const like = `%${escapeLike(query.search)}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('e.fullName LIKE :like', { like })
            .orWhere('e.nik LIKE :like')
            .orWhere('e.email LIKE :like');
        }),
      );
    }
    if (query.role) qb.andWhere('e.role = :role', { role: query.role });
    if (query.isActive !== undefined) {
      qb.andWhere('e.isActive = :isActive', { isActive: query.isActive });
    }

    const [rows, total] = await qb
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map(toEmployeeView),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<EmployeeView> {
    return toEmployeeView(await this.getEntity(id));
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeView> {
    const employee = await this.getEntity(id);

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== employee.email) {
        await this.assertUnique({ email }, id);
        employee.email = email;
      }
    }
    if (dto.fullName !== undefined) employee.fullName = dto.fullName;
    if (dto.position !== undefined) employee.position = dto.position;
    if (dto.role !== undefined) employee.role = dto.role;
    if (dto.isActive !== undefined) employee.isActive = dto.isActive;
    if (dto.password !== undefined) {
      employee.passwordHash = await bcrypt.hash(dto.password, this.rounds);
    }

    try {
      return toEmployeeView(await this.repo.save(employee));
    } catch (e) {
      throw this.translateDbError(e);
    }
  }

  /** Soft delete: isActive = false. */
  async remove(id: string): Promise<EmployeeView> {
    const employee = await this.getEntity(id);
    employee.isActive = false;
    return toEmployeeView(await this.repo.save(employee));
  }

  // ---- dipakai AuthService (bukan endpoint RPC) ----

  findByEmailWithPassword(email: string): Promise<Employee | null> {
    return this.repo
      .createQueryBuilder('e')
      .addSelect('e.passwordHash')
      .where('e.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  findEntityOrNull(id: string): Promise<Employee | null> {
    return this.repo.findOneBy({ id });
  }

  // ---- dipakai attendance lewat gateway (Fase 5B) ----

  /** ID karyawan (aktif maupun nonaktif) yang nama atau NIK-nya cocok. */
  async searchIds(search: string, limit: number): Promise<string[]> {
    const like = `%${escapeLike(search.trim())}%`;
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .where('e.fullName LIKE :like', { like })
      .orWhere('e.nik LIKE :like')
      .orderBy('e.id', 'ASC')
      .limit(limit)
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  /** Batch lookup satu query (bukan N+1). Tanpa filter isActive. */
  async findBriefsByIds(ids: string[]): Promise<EmployeeBrief[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({
      where: { id: In(ids) },
      select: { id: true, nik: true, fullName: true },
    });
    return rows.map((r) => ({ id: r.id, nik: r.nik, fullName: r.fullName }));
  }

  // ---- private ----

  private async getEntity(id: string): Promise<Employee> {
    const employee = await this.repo.findOneBy({ id });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async assertUnique(
    fields: { nik?: string; email?: string },
    excludeId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Employee>[] = [];
    if (fields.nik) where.push({ nik: fields.nik });
    if (fields.email) where.push({ email: fields.email });
    if (where.length === 0) return;

    const found = await this.repo.find({
      where,
      select: { id: true, nik: true, email: true },
    });
    for (const f of found) {
      if (f.id === excludeId) continue;
      if (fields.nik && f.nik.toLowerCase() === fields.nik.toLowerCase()) {
        throw new ConflictException('NIK already registered');
      }
      if (fields.email && f.email.toLowerCase() === fields.email.toLowerCase()) {
        throw new ConflictException('Email already registered');
      }
    }
  }

  private translateDbError(e: unknown): unknown {
    if (
      e instanceof QueryFailedError &&
      (e.driverError as { code?: string } | undefined)?.code === 'ER_DUP_ENTRY'
    ) {
      return new ConflictException('NIK or email already registered');
    }
    return e;
  }
}
```

### `absensi-wfh/backend/apps/employee-service/src/employees/employees.controller.ts` (timpa penuh)
```ts
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AllRpcExceptionsFilter,
  CreateEmployeeDto,
  EmployeePattern,
  QueryEmployeesDto,
  UpdateEmployeeDto,
} from '@app/common';
import { EmployeesService } from './employees.service';

@Controller()
@UseFilters(AllRpcExceptionsFilter)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @MessagePattern(EmployeePattern.EMPLOYEES_CREATE)
  create(@Payload() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_ALL)
  findAll(@Payload() query: QueryEmployeesDto) {
    return this.employees.findAll(query);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_ONE)
  findOne(@Payload() payload: { id: string }) {
    return this.employees.findOne(payload.id);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_UPDATE)
  update(@Payload() payload: { id: string; data: UpdateEmployeeDto }) {
    return this.employees.update(payload.id, payload.data);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_REMOVE)
  remove(@Payload() payload: { id: string }) {
    return this.employees.remove(payload.id);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_SEARCH_IDS)
  searchIds(@Payload() payload: { search: string; limit: number }) {
    return this.employees.searchIds(payload.search, payload.limit);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_BRIEFS)
  findBriefs(@Payload() payload: { ids: string[] }) {
    return this.employees.findBriefsByIds(payload.ids);
  }
}
```

---

## 3. attendance-service (TCP :3002)

### `absensi-wfh/backend/apps/attendance-service/tsconfig.app.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/attendance-service"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### `absensi-wfh/backend/apps/attendance-service/src/main.ts`
```ts
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AttendanceServiceModule } from './attendance-service.module';

async function bootstrap() {
  // Bind 127.0.0.1: port TCP tidak terjangkau dari luar mesin.
  const host = process.env.ATTENDANCE_SERVICE_HOST ?? '127.0.0.1';
  const port = Number(process.env.ATTENDANCE_SERVICE_PORT ?? 3002);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AttendanceServiceModule,
    { transport: Transport.TCP, options: { host, port } },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`attendance-service (TCP) listening on ${host}:${port}`, 'Bootstrap');
}

bootstrap();
```

### `absensi-wfh/backend/apps/attendance-service/src/attendance-service.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions, validateAttendanceServiceEnv } from '@app/common';
import { AttendancesModule } from './attendances/attendances.module';
import { Attendance } from './attendances/entities/attendance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateAttendanceServiceEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildTypeOrmOptions(config, [Attendance]),
    }),
    AttendancesModule,
  ],
})
export class AttendanceServiceModule {}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/entities/attendance.entity.ts`
Tidak ada relasi atau FK ke `employees`. `employee_id` hanya kolom biasa.
```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'attendances' })
@Unique('UQ_attendance_employee_date', ['employeeId', 'attendanceDate'])
@Index('IDX_attendance_date', ['attendanceDate'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Referensi lunak ke employees.id (tanpa FK lintas service). */
  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employeeId: string;

  @Column({ name: 'check_in_at', type: 'datetime' })
  checkInAt: Date;

  /** Tanggal kalender WIB, diturunkan dari checkInAt di server. */
  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'photo_path', type: 'varchar', length: 255 })
  photoPath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.service.ts`
```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  AttendanceRecord,
  CreateAttendancePayload,
  ListAttendancesPayload,
  PaginatedResult,
  wibDateString,
} from '@app/common';
import { Attendance } from './entities/attendance.entity';

const toRecord = (a: Attendance): AttendanceRecord => ({
  id: a.id,
  employeeId: a.employeeId,
  attendanceDate: a.attendanceDate,
  checkInAt: a.checkInAt,
  createdAt: a.createdAt,
  photoPath: a.photoPath,
  notes: a.notes,
});

const ALREADY_SUBMITTED = 'Attendance already submitted today';

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance) private readonly repo: Repository<Attendance>,
  ) {}

  /** Waktu dan tanggal absen SELALU dibuat di sini. Payload tidak membawa waktu. */
  async create(p: CreateAttendancePayload): Promise<AttendanceRecord> {
    const now = new Date();
    const attendanceDate = wibDateString(now);

    const existing = await this.repo.findOne({
      select: { id: true },
      where: { employeeId: p.employeeId, attendanceDate },
    });
    if (existing) throw new ConflictException(ALREADY_SUBMITTED);

    try {
      const saved = await this.repo.save(
        this.repo.create({
          employeeId: p.employeeId,
          checkInAt: now,
          attendanceDate,
          photoPath: p.photoPath,
          notes: p.notes?.trim() || null,
          createdAt: now,
        }),
      );
      return toRecord(saved);
    } catch (e) {
      // Balapan dua request bersamaan: constraint UNIK yang menang.
      if (
        e instanceof QueryFailedError &&
        (e.driverError as { code?: string } | undefined)?.code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException(ALREADY_SUBMITTED);
      }
      throw e;
    }
  }

  async findToday(employeeId: string): Promise<AttendanceRecord | null> {
    const row = await this.repo.findOneBy({
      employeeId,
      attendanceDate: wibDateString(),
    });
    return row ? toRecord(row) : null;
  }

  async findOne(id: string): Promise<AttendanceRecord> {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('Attendance not found');
    return toRecord(row);
  }

  /** Semua filter masuk satu WHERE, sehingga COUNT dan LIMIT/OFFSET konsisten. */
  async findAll(p: ListAttendancesPayload): Promise<PaginatedResult<AttendanceRecord>> {
    const page = Number(p.page) || 1;
    const limit = Number(p.limit) || 10;

    if (p.employeeIds && p.employeeIds.length === 0) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const qb = this.repo.createQueryBuilder('a');
    if (p.employeeIds) {
      qb.andWhere('a.employeeId IN (:...employeeIds)', { employeeIds: p.employeeIds });
    }
    if (p.dateFrom) qb.andWhere('a.attendanceDate >= :dateFrom', { dateFrom: p.dateFrom });
    if (p.dateTo) qb.andWhere('a.attendanceDate <= :dateTo', { dateTo: p.dateTo });

    const [rows, total] = await qb
      .orderBy('a.checkInAt', 'DESC')
      .addOrderBy('a.id', 'ASC') // tie-breaker: urutan stabil antar halaman
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map(toRecord),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.controller.ts`
```ts
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AllRpcExceptionsFilter,
  AttendancePattern,
  CreateAttendancePayload,
  ListAttendancesPayload,
} from '@app/common';
import { AttendancesService } from './attendances.service';

@Controller()
@UseFilters(AllRpcExceptionsFilter)
export class AttendancesController {
  constructor(private readonly attendances: AttendancesService) {}

  @MessagePattern(AttendancePattern.CREATE)
  create(@Payload() payload: CreateAttendancePayload) {
    return this.attendances.create(payload);
  }

  @MessagePattern(AttendancePattern.FIND_TODAY)
  findToday(@Payload() payload: { employeeId: string }) {
    return this.attendances.findToday(payload.employeeId);
  }

  @MessagePattern(AttendancePattern.FIND_ALL)
  findAll(@Payload() payload: ListAttendancesPayload) {
    return this.attendances.findAll(payload);
  }

  @MessagePattern(AttendancePattern.FIND_ONE)
  findOne(@Payload() payload: { id: string }) {
    return this.attendances.findOne(payload.id);
  }
}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.module.ts`
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { Attendance } from './entities/attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance])],
  controllers: [AttendancesController],
  providers: [AttendancesService],
})
export class AttendancesModule {}
```

---

## 4. api-gateway

### `absensi-wfh/backend/apps/api-gateway/src/clients/attendance-service.client.ts` (baru)
```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  ATTENDANCE_SERVICE,
  AttendancePattern,
  AttendanceRecord,
  CreateAttendancePayload,
  ListAttendancesPayload,
  PaginatedResult,
  sendRpc,
} from '@app/common';

@Injectable()
export class AttendanceServiceClient {
  private readonly timeoutMs: number;

  constructor(
    @Inject(ATTENDANCE_SERVICE) private readonly client: ClientProxy,
    config: ConfigService,
  ) {
    this.timeoutMs = config.getOrThrow<number>('RPC_TIMEOUT_MS');
  }

  private call<R, D>(pattern: string, data: D): Promise<R> {
    return sendRpc<R, D>(this.client, pattern, data, this.timeoutMs);
  }

  create(payload: CreateAttendancePayload) {
    return this.call<AttendanceRecord, CreateAttendancePayload>(
      AttendancePattern.CREATE,
      payload,
    );
  }

  findToday(employeeId: string) {
    return this.call<AttendanceRecord | null, { employeeId: string }>(
      AttendancePattern.FIND_TODAY,
      { employeeId },
    );
  }

  findAll(payload: ListAttendancesPayload) {
    return this.call<PaginatedResult<AttendanceRecord>, ListAttendancesPayload>(
      AttendancePattern.FIND_ALL,
      payload,
    );
  }

  findOne(id: string) {
    return this.call<AttendanceRecord, { id: string }>(AttendancePattern.FIND_ONE, { id });
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/clients/employee-service.client.ts` (timpa penuh)
Perubahan dari 5A: import `EmployeeBrief` dan dua method baru di akhir class.
```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthUser,
  CreateEmployeeDto,
  EMPLOYEE_SERVICE,
  EmployeeBrief,
  EmployeePattern,
  EmployeeView,
  LoginDto,
  LoginResult,
  PaginatedResult,
  QueryEmployeesDto,
  sendRpc,
  UpdateEmployeeDto,
} from '@app/common';

@Injectable()
export class EmployeeServiceClient {
  private readonly timeoutMs: number;

  constructor(
    @Inject(EMPLOYEE_SERVICE) private readonly client: ClientProxy,
    config: ConfigService,
  ) {
    this.timeoutMs = config.getOrThrow<number>('RPC_TIMEOUT_MS');
  }

  private call<R, D>(pattern: string, data: D): Promise<R> {
    return sendRpc<R, D>(this.client, pattern, data, this.timeoutMs);
  }

  login(dto: LoginDto) {
    return this.call<LoginResult, LoginDto>(EmployeePattern.AUTH_LOGIN, dto);
  }

  validateUser(id: string) {
    return this.call<AuthUser, { id: string }>(EmployeePattern.AUTH_VALIDATE, { id });
  }

  create(dto: CreateEmployeeDto) {
    return this.call<EmployeeView, CreateEmployeeDto>(
      EmployeePattern.EMPLOYEES_CREATE,
      dto,
    );
  }

  findAll(query: QueryEmployeesDto) {
    return this.call<PaginatedResult<EmployeeView>, QueryEmployeesDto>(
      EmployeePattern.EMPLOYEES_FIND_ALL,
      query,
    );
  }

  findOne(id: string) {
    return this.call<EmployeeView, { id: string }>(
      EmployeePattern.EMPLOYEES_FIND_ONE,
      { id },
    );
  }

  update(id: string, data: UpdateEmployeeDto) {
    return this.call<EmployeeView, { id: string; data: UpdateEmployeeDto }>(
      EmployeePattern.EMPLOYEES_UPDATE,
      { id, data },
    );
  }

  remove(id: string) {
    return this.call<EmployeeView, { id: string }>(
      EmployeePattern.EMPLOYEES_REMOVE,
      { id },
    );
  }

  searchIds(search: string, limit: number) {
    return this.call<string[], { search: string; limit: number }>(
      EmployeePattern.EMPLOYEES_SEARCH_IDS,
      { search, limit },
    );
  }

  findBriefsByIds(ids: string[]) {
    return this.call<EmployeeBrief[], { ids: string[] }>(
      EmployeePattern.EMPLOYEES_FIND_BRIEFS,
      { ids },
    );
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/clients/service-clients.module.ts` (timpa penuh)
```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ATTENDANCE_SERVICE, EMPLOYEE_SERVICE } from '@app/common';
import { AttendanceServiceClient } from './attendance-service.client';
import { EmployeeServiceClient } from './employee-service.client';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: EMPLOYEE_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.getOrThrow<string>('EMPLOYEE_SERVICE_HOST'),
            port: config.getOrThrow<number>('EMPLOYEE_SERVICE_PORT'),
          },
        }),
      },
      {
        name: ATTENDANCE_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.getOrThrow<string>('ATTENDANCE_SERVICE_HOST'),
            port: config.getOrThrow<number>('ATTENDANCE_SERVICE_PORT'),
          },
        }),
      },
    ]),
  ],
  providers: [EmployeeServiceClient, AttendanceServiceClient],
  exports: [EmployeeServiceClient, AttendanceServiceClient],
})
export class ServiceClientsModule {}
```

### `absensi-wfh/backend/apps/api-gateway/src/api-gateway.module.ts` (timpa penuh)
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateGatewayEnv } from '@app/common';
import { AttendancesModule } from './attendances/attendances.module';
import { AuthModule } from './auth/auth.module';
import { ServiceClientsModule } from './clients/service-clients.module';
import { EmployeesModule } from './employees/employees.module';
import { TimeModule } from './time/time.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateGatewayEnv,
    }),
    ServiceClientsModule,
    AuthModule,
    EmployeesModule,
    AttendancesModule,
    TimeModule,
  ],
})
export class ApiGatewayModule {}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.constants.ts`
```ts
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB
/** Batas ID hasil pencarian nama yang diteruskan ke attendance-service. */
export const SEARCH_ID_LIMIT = 1000;
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/utils/image-type.util.ts`
Validasi dari isi file (magic bytes). `mimetype` dan nama file dari klien diabaikan.
```ts
export interface DetectedImage {
  ext: 'jpg' | 'png' | 'webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
}

export const MIME_BY_EXT: Record<string, DetectedImage['mime']> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectImageType(buf: Buffer): DetectedImage | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buf.length >= 8 && PNG_SIG.every((b, i) => buf[i] === b)) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/photo-storage.service.ts`
```ts
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createReadStream, ReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MIME_BY_EXT } from './utils/image-type.util';

@Injectable()
export class PhotoStorageService implements OnModuleInit {
  private readonly logger = new Logger(PhotoStorageService.name);
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = path.resolve(process.cwd(), config.getOrThrow<string>('UPLOAD_DIR'));
  }

  async onModuleInit() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /** Nama file di-generate ulang (UUID). Nama dari klien tidak dipakai. Mengembalikan nama file. */
  async save(buffer: Buffer, ext: string): Promise<string> {
    const filename = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(this.dir, filename), buffer, { flag: 'wx', mode: 0o640 });
    return filename;
  }

  async remove(filename: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.dir, path.basename(filename)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Gagal menghapus ${filename}: ${(e as Error).message}`);
      }
    }
  }

  async open(photoPath: string): Promise<{ stream: ReadStream; mime: string; size: number }> {
    const filename = path.basename(photoPath); // cegah path traversal
    const mime = MIME_BY_EXT[path.extname(filename).slice(1).toLowerCase()];
    const full = path.join(this.dir, filename);
    if (!mime || !full.startsWith(this.dir + path.sep)) {
      throw new NotFoundException('Photo file not found');
    }
    try {
      const stat = await fs.stat(full);
      return { stream: createReadStream(full), mime, size: stat.size };
    } catch {
      throw new NotFoundException('Photo file not found');
    }
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendance.mapper.ts`
Satu-satunya tempat bentuk respons absensi ditentukan. `checkInAt` ditambahkan untuk kompatibilitas frontend.
```ts
import { AttendanceRecord, EmployeeBrief } from '@app/common';

export interface AttendanceView {
  id: string;
  employeeId: string;
  attendanceDate: string;
  createdAt: Date | string;
  /** KOMPAT FRONTEND: frontend membaca checkInAt (sama dengan createdAt). */
  checkInAt: Date | string;
  photoUrl: string;
  notes: string | null;
}

export interface AttendanceAdminView extends AttendanceView {
  employee: EmployeeBrief | null;
}

export const photoUrlFor = (id: string) => `/api/attendances/${id}/photo`;

export function toAttendanceView(r: AttendanceRecord): AttendanceView {
  return {
    id: r.id,
    employeeId: r.employeeId,
    attendanceDate: r.attendanceDate,
    createdAt: r.createdAt,
    checkInAt: r.checkInAt, // KOMPAT FRONTEND
    photoUrl: photoUrlFor(r.id),
    notes: r.notes,
  };
}

export function toAttendanceAdminView(
  r: AttendanceRecord,
  employee: EmployeeBrief | null,
): AttendanceAdminView {
  return { ...toAttendanceView(r), employee };
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/dto/attendance.dto.ts`
Alias snake_case (`date_from`, `date_to`, `employee_name`) ditambahkan untuk kompatibilitas frontend. Tanpa dideklarasikan di DTO, `ValidationPipe` (whitelist) akan membuangnya.
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAttendanceDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'WFH, mengerjakan modul laporan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class QueryMyAttendancesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'YYYY-MM-DD (WIB)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateFrom must be in YYYY-MM-DD format' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'YYYY-MM-DD (WIB)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateTo must be in YYYY-MM-DD format' })
  dateTo?: string;

  // KOMPAT FRONTEND: alias snake_case dari frontend Fase 3/4.
  @ApiPropertyOptional({ description: 'Alias dari dateFrom', example: '2026-11-01' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date_from must be in YYYY-MM-DD format' })
  date_from?: string;

  @ApiPropertyOptional({ description: 'Alias dari dateTo', example: '2026-11-30' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date_to must be in YYYY-MM-DD format' })
  date_to?: string;
}

export class QueryAttendancesDto extends QueryMyAttendancesDto {
  @ApiPropertyOptional({ description: 'Filter satu karyawan' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Cari nama atau NIK karyawan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  // KOMPAT FRONTEND: alias dari search.
  @ApiPropertyOptional({ description: 'Alias dari search' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  employee_name?: string;
}

export class AttendanceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ example: '2026-11-04' }) attendanceDate: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() checkInAt: string;
  @ApiProperty({ example: '/api/attendances/<id>/photo' }) photoUrl: string;
  @ApiProperty({ nullable: true }) notes: string | null;
}

export class AttendanceEmployeeDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
}

export class AttendanceAdminResponseDto extends AttendanceResponseDto {
  @ApiProperty({ type: AttendanceEmployeeDto, nullable: true })
  employee: AttendanceEmployeeDto | null;
}

class AttendanceMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class AttendanceListResponseDto {
  @ApiProperty({ type: [AttendanceResponseDto] }) data: AttendanceResponseDto[];
  @ApiProperty({ type: AttendanceMetaDto }) meta: AttendanceMetaDto;
}

export class AttendanceAdminListResponseDto {
  @ApiProperty({ type: [AttendanceAdminResponseDto] }) data: AttendanceAdminResponseDto[];
  @ApiProperty({ type: AttendanceMetaDto }) meta: AttendanceMetaDto;
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.service.ts`
Alias diselesaikan di `mine()` dan `list()` (`q.dateFrom ?? q.date_from`, dan seterusnya).
```ts
import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ReadStream } from 'fs';
import { AuthUser, PaginatedResult, Role } from '@app/common';
import { AttendanceServiceClient } from '../clients/attendance-service.client';
import { EmployeeServiceClient } from '../clients/employee-service.client';
import { SEARCH_ID_LIMIT } from './attendances.constants';
import {
  AttendanceAdminView,
  AttendanceView,
  toAttendanceAdminView,
  toAttendanceView,
} from './attendance.mapper';
import {
  CreateAttendanceDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
} from './dto/attendance.dto';
import { PhotoStorageService } from './photo-storage.service';
import { detectImageType } from './utils/image-type.util';

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
};

function assertDateRange(from?: string, to?: string) {
  if (from && !isRealDate(from)) throw new BadRequestException('dateFrom is not a valid date');
  if (to && !isRealDate(to)) throw new BadRequestException('dateTo is not a valid date');
  if (from && to && from > to) {
    throw new BadRequestException('dateFrom must not be after dateTo');
  }
}

@Injectable()
export class AttendancesService {
  private readonly logger = new Logger(AttendancesService.name);

  constructor(
    private readonly attendances: AttendanceServiceClient,
    private readonly employees: EmployeeServiceClient,
    private readonly storage: PhotoStorageService,
  ) {}

  async submit(
    user: AuthUser,
    file: Express.Multer.File | undefined,
    dto: CreateAttendanceDto,
  ): Promise<AttendanceView> {
    if (!file) throw new BadRequestException('Photo is required (field "photo")');

    const type = detectImageType(file.buffer);
    if (!type) throw new BadRequestException('Photo must be a JPEG, PNG, or WEBP image');

    const filename = await this.storage.save(file.buffer, type.ext);
    try {
      // employeeId SELALU dari token, tidak pernah dari body.
      const record = await this.attendances.create({
        employeeId: user.id,
        photoPath: filename,
        notes: dto.notes,
      });
      return toAttendanceView(record);
    } catch (err) {
      if (err instanceof GatewayTimeoutException) {
        // Hasil tidak pasti: record mungkin sudah tersimpan. File dibiarkan agar tidak ada record tanpa foto.
        this.logger.warn(`Timeout saat menyimpan absensi; file ${filename} dipertahankan`);
      } else {
        await this.storage.remove(filename); // rollback file
      }
      throw err;
    }
  }

  async today(user: AuthUser): Promise<AttendanceView | null> {
    const record = await this.attendances.findToday(user.id);
    return record ? toAttendanceView(record) : null;
  }

  async mine(user: AuthUser, q: QueryMyAttendancesDto): Promise<PaginatedResult<AttendanceView>> {
    // KOMPAT FRONTEND: terima alias snake_case.
    const dateFrom = q.dateFrom ?? q.date_from;
    const dateTo = q.dateTo ?? q.date_to;
    assertDateRange(dateFrom, dateTo);
    const result = await this.attendances.findAll({
      page: q.page,
      limit: q.limit,
      employeeIds: [user.id], // dari token
      dateFrom,
      dateTo,
    });
    return { data: result.data.map(toAttendanceView), meta: result.meta };
  }

  /**
   * Pagination dilakukan di DB attendance-service SETELAH semua filter (nama, tanggal, employeeId)
   * masuk ke WHERE yang sama. Nama/NIK ditempel setelah satu halaman terpotong, lewat satu batch lookup.
   */
  async list(q: QueryAttendancesDto): Promise<PaginatedResult<AttendanceAdminView>> {
    // KOMPAT FRONTEND: terima alias snake_case.
    const dateFrom = q.dateFrom ?? q.date_from;
    const dateTo = q.dateTo ?? q.date_to;
    const search = q.search ?? q.employee_name;
    assertDateRange(dateFrom, dateTo);

    let employeeIds: string[] | undefined;
    if (search) {
      const matched = await this.employees.searchIds(search, SEARCH_ID_LIMIT);
      if (matched.length >= SEARCH_ID_LIMIT) {
        this.logger.warn(`Pencarian "${search}" menyentuh batas ${SEARCH_ID_LIMIT} karyawan`);
      }
      employeeIds = q.employeeId ? matched.filter((id) => id === q.employeeId) : matched;
      if (employeeIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page: q.page, limit: q.limit, totalPages: 0 },
        };
      }
    } else if (q.employeeId) {
      employeeIds = [q.employeeId];
    }

    const result = await this.attendances.findAll({
      page: q.page,
      limit: q.limit,
      employeeIds,
      dateFrom,
      dateTo,
    });

    const ids = [...new Set(result.data.map((r) => r.employeeId))];
    const briefs = ids.length ? await this.employees.findBriefsByIds(ids) : [];
    const byId = new Map(briefs.map((b) => [b.id, b]));

    return {
      data: result.data.map((r) => toAttendanceAdminView(r, byId.get(r.employeeId) ?? null)),
      meta: result.meta,
    };
  }

  async openPhoto(
    user: AuthUser,
    id: string,
  ): Promise<{ stream: ReadStream; mime: string; size: number }> {
    const record = await this.attendances.findOne(id); // 404 jika tidak ada
    if (user.role !== Role.ADMIN_HRD && record.employeeId !== user.id) {
      throw new ForbiddenException('You are not allowed to view this photo');
    }
    return this.storage.open(record.photoPath);
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.controller.ts`
`@Get(['my', 'me'])` menambah alias `/attendances/me` yang dipakai frontend. Dua rute statis ini harus tetap dideklarasikan sebelum `:id/photo`.
```ts
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
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
import { memoryStorage } from 'multer';
import { AuthUser, Role } from '@app/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MAX_PHOTO_BYTES } from './attendances.constants';
import { AttendancesService } from './attendances.service';
import {
  AttendanceAdminListResponseDto,
  AttendanceListResponseDto,
  AttendanceResponseDto,
  CreateAttendanceDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
} from './dto/attendance.dto';

@ApiTags('attendances')
@ApiBearerAuth()
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendances: AttendancesService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'jpg/png/webp, maks 3 MB' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 },
    }),
  )
  submit(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendances.submit(user, photo, dto);
  }

  @Get('today')
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceResponseDto, description: 'null jika belum absen' })
  today(@CurrentUser() user: AuthUser) {
    return this.attendances.today(user);
  }

  // KOMPAT FRONTEND: 'me' adalah alias dari 'my' (frontend Fase 3/4 memanggil /attendances/me).
  @Get(['my', 'me'])
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceListResponseDto })
  mine(@CurrentUser() user: AuthUser, @Query() query: QueryMyAttendancesDto) {
    return this.attendances.mine(user, query);
  }

  @Get()
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceAdminListResponseDto })
  list(@Query() query: QueryAttendancesDto) {
    return this.attendances.list(query);
  }

  @Get(':id/photo')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary image stream' })
  @Header('Cache-Control', 'private, no-store')
  async photo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { stream, mime, size } = await this.attendances.openPhoto(user, id);
    return new StreamableFile(stream, { type: mime, length: size, disposition: 'inline' });
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.module.ts`
```ts
import { Module } from '@nestjs/common';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { PhotoStorageService } from './photo-storage.service';

@Module({
  controllers: [AttendancesController],
  providers: [AttendancesService, PhotoStorageService],
})
export class AttendancesModule {}
```

---

## 5. Konfigurasi (timpa penuh)

### `absensi-wfh/backend/package.json`
Perubahan dari 5A: hanya blok `scripts` (tambah `start:attendance`, `start:prod:attendance`, dan `build` serta `start:dev` ikut attendance-service).
```json
{
  "name": "absensi-wfh-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build api-gateway && nest build employee-service && nest build attendance-service",
    "start:gateway": "nest start api-gateway --watch",
    "start:employee": "nest start employee-service --watch",
    "start:attendance": "nest start attendance-service --watch",
    "start:dev": "concurrently -n employee,attendance,gateway -c blue,magenta,green \"npm:start:employee\" \"npm:start:attendance\" \"npm:start:gateway\"",
    "start:prod:gateway": "node dist/apps/api-gateway/main",
    "start:prod:employee": "node dist/apps/employee-service/main",
    "start:prod:attendance": "node dist/apps/attendance-service/main",
    "seed": "ts-node -r tsconfig-paths/register apps/employee-service/src/database/seed.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.8",
    "@nestjs/config": "^3.2.2",
    "@nestjs/core": "^10.3.8",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/microservices": "^10.3.8",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.8",
    "@nestjs/swagger": "^7.3.1",
    "@nestjs/typeorm": "^10.0.2",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "dotenv": "^16.4.5",
    "helmet": "^7.1.0",
    "mysql2": "^3.9.7",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.2",
    "@nestjs/schematics": "^10.1.1",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.12.12",
    "@types/passport-jwt": "^4.0.1",
    "concurrently": "^8.2.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.4.5"
  }
}
```

### `absensi-wfh/backend/nest-cli.json`
Perubahan dari 5A: proyek `attendance-service` ditambahkan sebelum `common`.
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/api-gateway/src",
  "monorepo": true,
  "root": "apps/api-gateway",
  "compilerOptions": {
    "webpack": true,
    "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
  },
  "projects": {
    "api-gateway": {
      "type": "application",
      "root": "apps/api-gateway",
      "entryFile": "main",
      "sourceRoot": "apps/api-gateway/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
      }
    },
    "employee-service": {
      "type": "application",
      "root": "apps/employee-service",
      "entryFile": "main",
      "sourceRoot": "apps/employee-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/employee-service/tsconfig.app.json"
      }
    },
    "attendance-service": {
      "type": "application",
      "root": "apps/attendance-service",
      "entryFile": "main",
      "sourceRoot": "apps/attendance-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/attendance-service/tsconfig.app.json"
      }
    },
    "common": {
      "type": "library",
      "root": "libs/common",
      "entryFile": "index",
      "sourceRoot": "libs/common/src",
      "compilerOptions": {
        "tsConfigPath": "libs/common/tsconfig.lib.json"
      }
    }
  }
}
```

### `absensi-wfh/backend/.env.example`
Perubahan dari 5A: bagian attendance-service dan upload diaktifkan. Tambahkan juga `ATTENDANCE_SERVICE_HOST`, `ATTENDANCE_SERVICE_PORT`, dan `UPLOAD_DIR` ke `.env` Anda.
```env
NODE_ENV=development

# ---- api-gateway (HTTP) ----
# Catatan: variabel lama PORT diganti GATEWAY_PORT
GATEWAY_PORT=3000
FRONTEND_URL=http://localhost:5173
RPC_TIMEOUT_MS=5000

# ---- employee-service (TCP, internal) ----
EMPLOYEE_SERVICE_HOST=127.0.0.1
EMPLOYEE_SERVICE_PORT=3001

# ---- attendance-service (TCP, internal) ----
ATTENDANCE_SERVICE_HOST=127.0.0.1
ATTENDANCE_SERVICE_PORT=3002

# ---- Upload foto (hanya dipakai gateway) ----
UPLOAD_DIR=./uploads

# ---- Database (dipakai employee-service dan attendance-service) ----
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=absensi_wfh
DB_USER=absensi_user
DB_PASSWORD=absensi_pass
DB_SYNCHRONIZE=true

# ---- JWT (secret SAMA dipakai gateway untuk verifikasi dan employee-service untuk menandatangani) ----
JWT_SECRET=ganti-dengan-string-acak-minimal-32-karakter-ya
JWT_EXPIRES_IN_SECONDS=28800
BCRYPT_ROUNDS=10
```

### `docker-compose.yml`
**Tidak ada perubahan.** Compose tetap hanya menjalankan MySQL. Port 3001 dan 3002 tidak dipublikasikan dan bind ke `127.0.0.1`. `uploads/` hanya disentuh gateway (attendance-service hanya menyimpan nama file). Jika kelak gateway dijalankan di container, mount volume ke gateway saja:
```yaml
  api-gateway:
    volumes:
      - uploads_data:/app/uploads   # + deklarasi uploads_data di blok volumes
```
Selama gateway jalan via npm, folder `backend/uploads` yang sama dengan monolit dipakai, sehingga foto lama tetap terbaca.

### Pembersihan
Folder `legacy-src/` (arsip dari 5A) **jangan dihapus dulu**. Skrip pembanding kontrak di bagian 8G butuh monolit lama (branch `main`). Hapus setelah perbandingan selesai. Jika sebelumnya Anda sempat membuat `apps/api-gateway/src/legacy`, hapus:
```bash
rm -rf apps/api-gateway/src/legacy
```

---

## 6. Paginasi daftar HRD dengan filter nama

Masalah umum: kalau gateway mengambil halaman dari attendance-service dulu lalu menyaring nama sesudahnya, halaman bisa bolong dan `total` salah. Solusi di sini:

1. **Filter nama didorong ke bawah, bukan disaring belakangan.** Gateway menerjemahkan `search` menjadi daftar `employeeIds`, lalu attendance-service menjalankan `WHERE employee_id IN (...) AND attendance_date BETWEEN ...` pada query yang sama dengan `COUNT`, `LIMIT`, dan `OFFSET`. `meta.total` dan `totalPages` dihitung DB dari himpunan yang sudah terfilter, jadi tidak pernah dihitung ulang di gateway.
2. **Pengayaan nama dan NIK terjadi setelah halaman dipotong**, dengan satu batch `findBriefsByIds` (maksimal `limit` ≤ 100 ID unik). Tidak ada N+1, dan pengayaan tidak mengubah jumlah baris.
3. **Urutan stabil**: `check_in_at DESC, id ASC`, supaya baris tidak berpindah antar halaman.
4. **Kasus tepi**:
   - Pencarian tanpa hasil mengembalikan halaman kosong dengan `total: 0` tanpa memanggil attendance-service.
   - `search` bersama `employeeId` berarti irisan keduanya.
   - Karyawan nonaktif tetap ikut dicari dan ditampilkan, karena absensi historis tidak boleh hilang.
   - Jika satu pencarian cocok dengan lebih dari 1000 karyawan, hasil dipotong dan ada log peringatan. Untuk skala itu, solusinya menyimpan snapshot nama di tabel absensi atau membuat endpoint gabungan. Untuk tes teknis, batas ini cukup.

---

## 7. Perintah menjalankan

```bash
cd absensi-wfh/backend
docker compose down -v            # disarankan sekali: skema attendances lama punya FK ke employees
docker compose up -d              # tunggu healthy
# pastikan .env berisi ATTENDANCE_SERVICE_HOST, ATTENDANCE_SERVICE_PORT, dan UPLOAD_DIR
npm install
npm run typecheck                 # harus 0 error
npm run seed                      # akun demo
npm run start:dev                 # employee :3001, attendance :3002, gateway :3000
```

Jika tidak mau menghapus volume, jalankan manual `ALTER TABLE attendances DROP FOREIGN KEY <nama_fk>` (lihat `SHOW CREATE TABLE attendances`). Tabel `attendances` dibuat oleh attendance-service saat start (`DB_SYNCHRONIZE=true`). Untuk produksi, ganti dengan migration.

---

## 8. Skenario uji

Butuh `curl` dan `jq` (Linux, WSL, atau Git Bash). Jalankan dari `absensi-wfh/backend`.

```bash
B=http://localhost:3000/api
login() { curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .accessToken; }
ADMIN=$(login admin@company.test 'Admin123!')
BUDI=$(login budi@company.test 'Karyawan123!')
base64 -d > /tmp/ok.png <<< 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
```

**A. Absen sukses (201)**
```bash
curl -s -X POST $B/attendances -H "Authorization: Bearer $BUDI" \
  -F photo=@/tmp/ok.png -F notes='WFH hari ini' \
  -F checkInAt='2020-01-01T00:00:00Z' | tee /tmp/a.json | jq
ls uploads | wc -l
```
Harapan:
- Status 201 dan body berisi `id, employeeId, attendanceDate, createdAt, checkInAt, photoUrl, notes`.
- `attendanceDate` adalah hari ini (WIB), `createdAt` dan `checkInAt` waktu server. `checkInAt` palsu dari klien diabaikan.
- Ada file `uuid.png` baru di `uploads/`.

**B. Absen kedua (409) dan file tidak menumpuk**
```bash
curl -s -w '\n%{http_code}\n' -X POST $B/attendances -H "Authorization: Bearer $BUDI" -F photo=@/tmp/ok.png
ls uploads | wc -l      # sama dengan sebelumnya: file rollback terhapus
```

**C. File bukan gambar ditolak**
```bash
echo "ini bukan gambar" > /tmp/fake.png
curl -s -w '\n%{http_code}\n' -X POST $B/attendances -H "Authorization: Bearer $BUDI" \
  -F "photo=@/tmp/fake.png;type=image/png"          # 400 walau mimetype dipalsukan
head -c 3500000 /dev/zero > /tmp/big.png
curl -s -w '\n%{http_code}\n' -X POST $B/attendances -H "Authorization: Bearer $BUDI" \
  -F "photo=@/tmp/big.png;type=image/png"           # 413 (> 3 MB)
curl -s -w '\n%{http_code}\n' -X POST $B/attendances -H "Authorization: Bearer $BUDI"   # 400 tanpa foto
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/attendances -H "Authorization: Bearer $ADMIN" -F photo=@/tmp/ok.png  # 403
ls uploads | wc -l                                  # tetap tidak bertambah
```
Hasil 409 pada B hanya terjadi setelah A. Jika B dijalankan di hari yang sama dengan absen yang sudah ada, urutannya tetap valid.

**D. Filter nama dan paginasi**
```bash
curl -s -X POST $B/employees -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"nik":"2000000002","fullName":"Ani Wijaya","email":"ani@company.test","password":"Karyawan123!","position":"QA Engineer","role":"EMPLOYEE"}' >/dev/null
ANI=$(login ani@company.test 'Karyawan123!')
curl -s -X POST $B/attendances -H "Authorization: Bearer $ANI" -F photo=@/tmp/ok.png >/dev/null

curl -s "$B/attendances?search=budi" -H "Authorization: Bearer $ADMIN" \
  | jq '{total:.meta.total, names:[.data[].employee.fullName]}'        # hanya Budi
curl -s "$B/attendances?employee_name=budi" -H "Authorization: Bearer $ADMIN" | jq .meta.total   # alias: 1
curl -s "$B/attendances?search=zzz" -H "Authorization: Bearer $ADMIN" | jq .meta   # total 0
curl -s "$B/attendances?search=a&limit=1&page=2" -H "Authorization: Bearer $ADMIN" \
  | jq '{meta, n:(.data|length)}'                  # total 2, totalPages 2, n 1 ("Admin HRD" cocok tetapi tak punya absen)
curl -s "$B/attendances?dateFrom=2999-01-01" -H "Authorization: Bearer $ADMIN" | jq .meta  # kosong
curl -s "$B/attendances?date_from=2999-01-01" -H "Authorization: Bearer $ADMIN" | jq .meta # alias: kosong
curl -s -o /dev/null -w '%{http_code}\n' "$B/attendances" -H "Authorization: Bearer $BUDI" # 403
```

**E. Karyawan A tidak bisa membuka foto karyawan B**
```bash
ID=$(jq -r .id /tmp/a.json)       # absensi milik Budi
curl -s -o /dev/null -w 'ani   -> %{http_code}\n' $B/attendances/$ID/photo -H "Authorization: Bearer $ANI"    # 403
curl -s -o /dev/null -w 'budi  -> %{http_code} %{content_type}\n' $B/attendances/$ID/photo -H "Authorization: Bearer $BUDI"   # 200 image/png
curl -s -o /dev/null -w 'admin -> %{http_code}\n' $B/attendances/$ID/photo -H "Authorization: Bearer $ADMIN"  # 200
curl -s -o /dev/null -w 'anon  -> %{http_code}\n' $B/attendances/$ID/photo                                    # 401
curl -s -o /dev/null -w 'bad   -> %{http_code}\n' $B/attendances/bukan-uuid/photo -H "Authorization: Bearer $BUDI"  # 400
```

**F. Ketahanan**
Matikan `attendance-service`, lalu `POST /attendances` dan `GET /attendances/my` mengembalikan 503, dan file yang sudah ditulis dihapus kembali. Aktifkan lagi dan semuanya normal.

**G. Respons identik dengan versi sebelum refaktor**
Skrip ini membandingkan status, content-type, dan bentuk JSON (nama kunci dan tipe, bukan nilai).

Catatan: skrip memakai `/attendances/today` dan `/attendances/my`. Jika monolit lama (branch `main`) belum punya dua rute itu (frontend Fase 3/4 memakai `/attendances/me`), baris `today-kosong`, `today`, dan `my` akan berbeda di diff. Itu selisih yang wajar. Ubah rute di skrip ke `/attendances/me` jika ingin membandingkan apple to apple.

### `absensi-wfh/backend/scripts/contract-snapshot.sh` (baru)
```bash
#!/usr/bin/env bash
# Pemakaian: ./scripts/contract-snapshot.sh http://localhost:3000/api > snapshot-<label>.txt
set -u
B=${1:?base url}
TMP=$(mktemp -d)
base64 -d > "$TMP/ok.png" <<< 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
echo "bukan gambar" > "$TMP/fake.png"

shape() { jq -S 'walk(if type=="array" then .[0:1] elif type=="object" then . else type end)' 2>/dev/null || echo "(bukan JSON)"; }
call() {
  local name=$1; shift
  local meta; meta=$(curl -s -o "$TMP/body" -w '%{http_code} %{content_type}' "$@")
  echo "### $name -> $meta"
  case "$meta" in *json*) shape < "$TMP/body" ;; *) echo "(body $(wc -c < "$TMP/body") byte non-JSON)" ;; esac
}
tok() { curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .accessToken; }

ADMIN=$(tok admin@company.test 'Admin123!'); BUDI=$(tok budi@company.test 'Karyawan123!')
H_A="Authorization: Bearer $ADMIN"; H_B="Authorization: Bearer $BUDI"

call time            "$B/time"
call login-salah     -X POST "$B/auth/login" -H 'Content-Type: application/json' -d '{"email":"budi@company.test","password":"x"}'
call me              "$B/auth/me" -H "$H_B"
call employees-list  "$B/employees?page=1&limit=5" -H "$H_A"
call employees-403   "$B/employees" -H "$H_B"
call today-kosong    "$B/attendances/today" -H "$H_B"
call absen-fake      -X POST "$B/attendances" -H "$H_B" -F "photo=@$TMP/fake.png;type=image/png"
call absen-ok        -X POST "$B/attendances" -H "$H_B" -F "photo=@$TMP/ok.png" -F notes=tes
ID=$(jq -r .id < "$TMP/body")
call absen-409       -X POST "$B/attendances" -H "$H_B" -F "photo=@$TMP/ok.png"
call today           "$B/attendances/today" -H "$H_B"
call my              "$B/attendances/my?page=1&limit=5" -H "$H_B"
call hrd-list        "$B/attendances?page=1&limit=5" -H "$H_A"
call hrd-search      "$B/attendances?search=budi" -H "$H_A"
call hrd-403         "$B/attendances" -H "$H_B"
call foto-owner      "$B/attendances/$ID/photo" -H "$H_B"
call foto-admin      "$B/attendances/$ID/photo" -H "$H_A"
call foto-anon       "$B/attendances/$ID/photo"
call foto-404        "$B/attendances/00000000-0000-4000-8000-000000000000/photo" -H "$H_A"
call foto-bad-id     "$B/attendances/xyz/photo" -H "$H_B"
```

Cara memakai (DB direset di antara dua putaran, karena skrip membuat absen):
```bash
chmod +x scripts/contract-snapshot.sh && mkdir -p out
# 1) VERSI LAMA: checkout commit monolit (branch main), jalankan di :3000
docker compose down -v && docker compose up -d && npm run seed && npm run start:dev
./scripts/contract-snapshot.sh http://localhost:3000/api > out/lama.txt     # lalu hentikan server
# 2) VERSI BARU: branch refactor/microservices
docker compose down -v && docker compose up -d && npm run seed && npm run start:dev
./scripts/contract-snapshot.sh http://localhost:3000/api > out/baru.txt
diff out/lama.txt out/baru.txt && echo "KONTRAK IDENTIK"
```
Setiap selisih menunjuk titik yang harus disesuaikan. Hampir semuanya ada di `attendance.mapper.ts` atau di teks pesan error di gateway.

**H. Dengan frontend (`npm run dev` di `frontend/`)**
1. Login sebagai budi. Halaman `/absensi` memuat status hari ini dan riwayat tanpa error (memakai `/attendances/me`).
2. Kirim absen dengan foto. Kartu berubah menjadi "Absen hari ini sudah tercatat" dengan jam server dan foto muncul.
3. Login sebagai admin, buka `/hrd/monitoring`. Baris budi muncul dengan NIK, nama, tanggal, jam WIB, dan thumbnail. Filter nama dan rentang tanggal bekerja, dan lightbox menampilkan foto.

---

## 9. Ringkasan file

**Baru:**
```
libs/common/src/interfaces/attendance.interface.ts
apps/attendance-service/tsconfig.app.json
apps/attendance-service/src/main.ts
apps/attendance-service/src/attendance-service.module.ts
apps/attendance-service/src/attendances/attendances.module.ts
apps/attendance-service/src/attendances/attendances.controller.ts
apps/attendance-service/src/attendances/attendances.service.ts
apps/attendance-service/src/attendances/entities/attendance.entity.ts
apps/api-gateway/src/clients/attendance-service.client.ts
apps/api-gateway/src/attendances/attendances.module.ts
apps/api-gateway/src/attendances/attendances.controller.ts
apps/api-gateway/src/attendances/attendances.service.ts
apps/api-gateway/src/attendances/attendances.constants.ts
apps/api-gateway/src/attendances/attendance.mapper.ts
apps/api-gateway/src/attendances/photo-storage.service.ts
apps/api-gateway/src/attendances/dto/attendance.dto.ts
apps/api-gateway/src/attendances/utils/image-type.util.ts
scripts/contract-snapshot.sh
```

**Ditimpa:**
```
libs/common/src/index.ts
libs/common/src/constants/rpc.constants.ts
libs/common/src/interfaces/employee.interface.ts
libs/common/src/utils/wib.util.ts
libs/common/src/config/env.validation.ts
apps/employee-service/src/employees/employees.service.ts
apps/employee-service/src/employees/employees.controller.ts
apps/api-gateway/src/api-gateway.module.ts
apps/api-gateway/src/clients/service-clients.module.ts
apps/api-gateway/src/clients/employee-service.client.ts
package.json, nest-cli.json, .env.example
```

**Dihapus:** `apps/api-gateway/src/legacy/` (hanya jika sempat dibuat). `legacy-src/` dipertahankan sampai perbandingan kontrak selesai.

---

## 10. Keputusan default dan hal yang HARUS dicek

Dokumen sumber tidak memuat kode monolit lama, hanya serah-terima. Poin 1 sampai 3 adalah tebakan terbaik dan paling mungkin membuat skrip 8G menunjukkan selisih.

1. **Bentuk `AttendanceView`.** Kontrak sumber: `id, employeeId, attendanceDate, createdAt, photoUrl, notes`. Saya menambah `checkInAt` (nilainya sama dengan `createdAt`) karena frontend membacanya. Daftar HRD menambah `employee: { id, nik, fullName }`. Cocokkan dengan mapper monolit lama dan ubah hanya `attendance.mapper.ts`.
2. **Format `photoUrl`.** Dipakai `/api/attendances/{id}/photo`. Frontend Fase 3/4 tidak memakai `photoUrl` (foto diambil lewat `/attendances/{id}/photo` dengan Axios), jadi aman. Ubah di `photoUrlFor` jika ada konsumen lain.
3. **Pesan dan status error.** 409 `Attendance already submitted today`, 400 untuk file bukan gambar, 413 untuk file > 3 MB, dan 403 untuk foto milik orang lain. Samakan dengan hasil `lama.txt` jika berbeda.
4. **`search`** mencocokkan nama atau NIK (bukan email).
5. **`createdAt` sama dengan `checkInAt`**, keduanya dari satu `new Date()` di attendance-service.
6. **Waktu mengikuti TypeORM `timezone: '+07:00'`.** `attendanceDate` dihitung dengan `Intl` zona `Asia/Jakarta`, bukan dari zona mesin.
7. **Timeout RPC saat menyimpan absen** (504) sengaja tidak menghapus file, karena record mungkin sudah tersimpan. Error pasti (409, 4xx, 5xx, 503) menghapus file.
8. **Dua service memakai `synchronize` pada satu DB.** Aman karena tiap service hanya menyentuh tabelnya sendiri, tetapi untuk produksi ganti dengan migration.
9. **Tidak ada FK lintas service.** `employee_id` adalah kolom varchar(36) biasa. Integritasnya dijaga karena `employeeId` selalu berasal dari token yang divalidasi `auth.validate`.
10. **Employee pada daftar HRD hanya `{id, nik, fullName}`.** Frontend Fase 4 menampilkan `position` di bawah nama jika ada, jadi barisnya tetap tampil, hanya tanpa jabatan. Tambahkan `position` ke `EmployeeBrief` dan `findBriefsByIds` jika ingin jabatan tampil.
11. **Belum dikerjakan (di luar cakupan 5B):** object storage, thumbnail, token revocation, dan cache untuk `auth.validate`.
