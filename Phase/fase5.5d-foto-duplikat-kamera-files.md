# Fase 5.6: Deteksi Foto Duplikat (Backend) + Ambil Foto dari Kamera (Frontend) (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Dokumen ini menggabungkan dua perubahan yang saling melengkapi:
- **Bagian A (backend):** server menghitung SHA-256 dari isi foto dan menolak absen dengan foto yang byte-nya identik dengan foto absen mana pun yang sudah tersimpan (lintas karyawan dan lintas hari).
- **Bagian B (frontend):** karyawan mengambil foto langsung dari kamera depan (`getUserMedia`), bukan memilih file. Unggah file hanya muncul sebagai fallback saat kamera tidak bisa dipakai.

Prasyarat: Fase 3, audit Fase 3, Fase 4, Fase 5A, 5B, 5.5-A, 5.5-B/C (backend), dan 5.5 Frontend-A sudah terpasang dan lulus tes. Jika 5.5-B/C backend belum dipasang, file backend di bagian A tetap bisa dipakai, tetapi `attendances.service.ts` (gateway dan attendance-service) di sini sudah memuat isi 5.5-B/C, jadi pasang 5.5-B/C lebih dulu agar tidak kehilangan fitur summary, filter status, dan export. Buat setiap file pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya. File yang ditandai "(diubah)" ditimpa penuh.

Catatan penting:
- Path backend relatif terhadap `absensi-wfh/backend/`, path frontend relatif terhadap `absensi-wfh/frontend/src/`.
- Tidak ada dependensi npm baru, env baru, atau token desain baru. Semua ikon berasal dari `lucide-react` yang sudah terpasang.
- **Kontrak HTTP tidak berubah.** Tidak ada field baru di request maupun response. `photoHash` tidak dimasukkan ke `AttendanceRecord`, jadi tidak bocor ke klien. Satu-satunya perilaku baru yang terlihat klien adalah respons 400 `Foto ini sudah pernah digunakan. Ambil foto baru.`
- `AttendanceServiceClient.create` di gateway meneruskan objek payload apa adanya ke RPC, jadi **tidak perlu diubah**. `photoHash` otomatis ikut terkirim.
- Kode ditulis tanpa dijalankan. Setelah semua file dibuat, jalankan `npm run typecheck` di backend dan `npm run typecheck && npm run build` di frontend, perbaiki error compile bila ada tanpa mengubah perilaku yang dijelaskan di sini, lalu uji dengan bagian "Skenario uji".

---

# Bagian A: Backend, deteksi foto duplikat

## A1. `libs/common`

### `absensi-wfh/backend/libs/common/src/interfaces/attendance.interface.ts` (diubah)
Hanya `CreateAttendancePayload` yang berubah (field `photoHash` opsional, agar pemanggil lama tetap valid).
```ts
import { AttendanceStatus } from '../enums/attendance-status.enum';

/** Bentuk data antar-service. photoPath bersifat internal, tidak boleh bocor ke klien. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD (WIB)
  checkInAt: Date | string;
  createdAt: Date | string;
  photoPath: string;
  notes: string | null;
  /** Disimpan saat absen; tidak berubah walau pengaturan diubah kemudian. */
  status: AttendanceStatus;
  /** Menit dari batas jam masuk dasar (defaultCutoffTime). 0 jika tepat waktu. */
  lateMinutes: number;
}

export interface CreateAttendancePayload {
  employeeId: string;
  photoPath: string;
  notes?: string | null;
  /** SHA-256 (hex, 64 karakter) isi file, dihitung gateway. Dipakai untuk deteksi foto duplikat. */
  photoHash?: string | null;
}

/** Dipakai oleh /attendances (HRD), /attendances/export, dan /attendances/my (employeeIds = [id dari token]). */
export interface ListAttendancesPayload {
  page: number;
  limit: number;
  employeeIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
}

/** Pengaturan jam kerja (satu baris global). Waktu berformat HH:mm (WIB). */
export interface AttendanceSettingsRecord {
  earliestCheckIn: string;
  defaultCutoffTime: string;
  toleranceMinutes: number;
  requireNoteWhenLate: boolean;
  /** 0 = Minggu ... 6 = Sabtu */
  workingDays: number[];
}

/** PATCH parsial: hanya field yang dikirim yang diubah. */
export type UpdateAttendanceSettingsPayload = Partial<AttendanceSettingsRecord>;

/** Statistik harian, dihitung hanya untuk employeeIds yang dikirim gateway. */
export interface DailyStatsPayload {
  /** YYYY-MM-DD (WIB) */
  date: string;
  employeeIds: string[];
}

export interface DailyStatsResult {
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  /** Sudah absen pada tanggal itu; gateway memakainya untuk menentukan yang belum absen. */
  presentEmployeeIds: string[];
}
```

## A2. `attendance-service`

### `absensi-wfh/backend/apps/attendance-service/src/attendances/entities/attendance.entity.ts` (diubah)
Kolom baru `photo_hash VARCHAR(64) NULL` dan index non-unik `IDX_attendance_photo_hash`.
```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AttendanceStatus } from '@app/common';

@Entity({ name: 'attendances' })
@Unique('UQ_attendance_employee_date', ['employeeId', 'attendanceDate'])
@Index('IDX_attendance_date', ['attendanceDate'])
@Index('IDX_attendance_photo_hash', ['photoHash'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Referensi lunak ke employees.id (tanpa FK fisik lintas service). */
  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employeeId: string;

  @Column({ name: 'check_in_at', type: 'datetime' })
  checkInAt: Date;

  /** Tanggal kalender WIB, diturunkan dari checkInAt di server. */
  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'photo_path', type: 'varchar', length: 255 })
  photoPath: string;

  /** SHA-256 isi foto (hex). Null untuk data lama sebelum fitur anti-duplikat. */
  @Column({ name: 'photo_hash', type: 'varchar', length: 64, nullable: true })
  photoHash: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  /** Dihitung & disimpan saat absen. Tidak dihitung ulang saat pengaturan berubah. */
  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.ON_TIME,
  })
  status: AttendanceStatus;

  @Column({ name: 'late_minutes', type: 'int', default: 0 })
  lateMinutes: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.service.ts` (diubah)
Hanya method `create` yang berubah (blok "Deteksi foto duplikat" dan `photoHash` pada `repo.create`). `toRecord` dan method lain tetap, sehingga `photoHash` tidak pernah ikut ke `AttendanceRecord`.
```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  AttendanceRecord,
  AttendanceStatus,
  CreateAttendancePayload,
  DAY_NAMES_ID,
  DailyStatsPayload,
  DailyStatsResult,
  formatWorkingDays,
  hmToMinutes,
  ListAttendancesPayload,
  PaginatedResult,
  wibDateString,
  wibDayOfWeek,
  wibMinutesOfDay,
} from '@app/common';
import { AttendanceSettingsService } from './attendance-settings.service';
import { Attendance } from './entities/attendance.entity';

const toRecord = (a: Attendance): AttendanceRecord => ({
  id: a.id,
  employeeId: a.employeeId,
  attendanceDate: a.attendanceDate,
  checkInAt: a.checkInAt,
  createdAt: a.createdAt,
  photoPath: a.photoPath,
  notes: a.notes,
  status: a.status,
  lateMinutes: a.lateMinutes,
});

const ALREADY_SUBMITTED = 'Attendance already submitted today';

@Injectable()
export class AttendancesService {
  constructor(
    @InjectRepository(Attendance) private readonly repo: Repository<Attendance>,
    private readonly settings: AttendanceSettingsService,
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

    // ---- Aturan jam kerja (dibaca dari pengaturan saat ini) ----
    const s = await this.settings.get();
    const minutesNow = wibMinutesOfDay(now);
    const dayOfWeek = wibDayOfWeek(now);

    if (!s.workingDays.includes(dayOfWeek)) {
      throw new BadRequestException(
        `Hari ini (${DAY_NAMES_ID[dayOfWeek]}) bukan hari kerja. ` +
          `Absensi hanya dapat dilakukan pada hari: ${formatWorkingDays(s.workingDays)}.`,
      );
    }
    if (minutesNow < hmToMinutes(s.earliestCheckIn)) {
      throw new BadRequestException(
        `Absensi belum dibuka. Absen dapat dilakukan mulai pukul ${s.earliestCheckIn} WIB.`,
      );
    }

    const cutoff = hmToMinutes(s.defaultCutoffTime);
    const isLate = minutesNow > cutoff + s.toleranceMinutes;
    const lateMinutes = isLate ? minutesNow - cutoff : 0; // dari cut-off dasar, bukan batas toleransi
    const notes = p.notes?.trim() || null;

    if (isLate && s.requireNoteWhenLate && !notes) {
      throw new BadRequestException(
        `Anda terlambat ${lateMinutes} menit (batas masuk ${s.defaultCutoffTime} WIB, ` +
          `toleransi ${s.toleranceMinutes} menit). Catatan wajib diisi untuk absen terlambat.`,
      );
    }

    // ---- Deteksi foto duplikat (lintas karyawan, hanya terhadap absen yang tersimpan) ----
    const photoHash = p.photoHash?.trim().toLowerCase() || null;
    if (photoHash) {
      const sameHash = await this.repo.findOne({
        select: { id: true },
        where: { photoHash },
      });
      if (sameHash) {
        throw new BadRequestException('Foto ini sudah pernah digunakan. Ambil foto baru.');
      }
    }

    try {
      const saved = await this.repo.save(
        this.repo.create({
          employeeId: p.employeeId,
          checkInAt: now,
          attendanceDate,
          photoPath: p.photoPath,
          photoHash,
          notes,
          status: isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
          lateMinutes,
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
    if (p.status) qb.andWhere('a.status = :status', { status: p.status });

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

  /**
   * Statistik satu hari, HANYA untuk employeeIds yang dikirim gateway
   * (aktif + role EMPLOYEE). Satu query; UNIK (employee_id, attendance_date)
   * menjamin satu baris per karyawan, jadi jumlah baris = jumlah hadir.
   */
  async getDailyStats(p: DailyStatsPayload): Promise<DailyStatsResult> {
    const ids = p.employeeIds ?? [];
    if (ids.length === 0) {
      return { presentCount: 0, onTimeCount: 0, lateCount: 0, presentEmployeeIds: [] };
    }

    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.employeeId', 'employeeId')
      .addSelect('a.status', 'status')
      .where('a.attendanceDate = :date', { date: p.date })
      .andWhere('a.employeeId IN (:...ids)', { ids })
      .getRawMany<{ employeeId: string; status: AttendanceStatus }>();

    const lateCount = rows.filter((r) => r.status === AttendanceStatus.LATE).length;
    return {
      presentCount: rows.length,
      onTimeCount: rows.length - lateCount,
      lateCount,
      presentEmployeeIds: rows.map((r) => r.employeeId),
    };
  }
}
```

## A3. `api-gateway`

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.service.ts` (diubah)
Perubahan: import `createHash` dan method `submit` (hash dihitung dari byte yang diterima server, lalu dikirim sebagai `photoHash`). Blok `catch` tidak berubah: error 400 dari attendance-service (aturan jam kerja maupun foto duplikat) sudah masuk ke `storage.remove(filename)`, jadi file yang ditolak otomatis dihapus.
```ts
import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { ReadStream } from 'fs';
import {
  AttendanceRecord,
  AttendanceSettingsRecord,
  AttendanceStatus,
  AuthUser,
  EmployeeBrief,
  PaginatedResult,
  Role,
  UpdateAttendanceSettingsPayload,
  formatWibIso,
  wibDateString,
} from '@app/common';
import { AttendanceServiceClient } from '../clients/attendance-service.client';
import { EmployeeServiceClient } from '../clients/employee-service.client';
import { EXPORT_MAX_ROWS } from './attendances.export.constants';
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
  QuerySummaryDto,
  UpdateAttendanceSettingsDto,
} from './dto/attendance.dto';
import { PhotoStorageService } from './photo-storage.service';
import { buildCsv } from './utils/csv.util';
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

export interface AttendanceSummaryView {
  date: string;
  totalEmployees: number;
  presentCount: number;
  onTimeCount: number;
  lateCount: number;
  absentCount: number;
  absentEmployees: { id: string; fullName: string; nik: string }[];
}

type AttendanceFilterInput = Pick<
  QueryAttendancesDto,
  'dateFrom' | 'dateTo' | 'date_from' | 'date_to' | 'search' | 'employee_name' | 'employeeId' | 'status'
>;

interface ResolvedFilter {
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
  employeeIds?: string[];
  /** true jika pencarian nama/NIK tidak cocok dengan siapa pun: hasil pasti kosong. */
  noMatch: boolean;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  [AttendanceStatus.ON_TIME]: 'Tepat Waktu',
  [AttendanceStatus.LATE]: 'Terlambat',
};

const CSV_HEADER = [
  'NIK',
  'Nama Karyawan',
  'Tanggal',
  'Jam (WIB)',
  'Status',
  'Keterlambatan (Menit)',
  'Catatan',
];

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

    // Hash dihitung dari byte yang diterima server, bukan dari data klien.
    const photoHash = createHash('sha256').update(file.buffer).digest('hex');

    const filename = await this.storage.save(file.buffer, type.ext);
    try {
      // employeeId SELALU dari token, tidak pernah dari body.
      const record = await this.attendances.create({
        employeeId: user.id,
        photoPath: filename,
        notes: dto.notes,
        photoHash,
      });
      return toAttendanceView(record);
    } catch (err) {
      if (err instanceof GatewayTimeoutException) {
        this.logger.warn(`Timeout saat menyimpan absensi; file ${filename} dipertahankan`);
      } else {
        await this.storage.remove(filename); // rollback file (termasuk 400 aturan jam kerja dan foto duplikat)
      }
      throw err;
    }
  }

  async today(user: AuthUser): Promise<AttendanceView | null> {
    const record = await this.attendances.findToday(user.id);
    return record ? toAttendanceView(record) : null;
  }

  async mine(user: AuthUser, q: QueryMyAttendancesDto): Promise<PaginatedResult<AttendanceView>> {
    const dateFrom = q.dateFrom ?? q.date_from;
    const dateTo = q.dateTo ?? q.date_to;
    assertDateRange(dateFrom, dateTo);
    const result = await this.attendances.findAll({
      page: q.page,
      limit: q.limit,
      employeeIds: [user.id],
      dateFrom,
      dateTo,
    });
    return { data: result.data.map(toAttendanceView), meta: result.meta };
  }

  /** Filter bersama untuk daftar HRD dan export, supaya perilakunya selalu sama. */
  private async resolveFilter(q: AttendanceFilterInput): Promise<ResolvedFilter> {
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
        return { dateFrom, dateTo, status: q.status, employeeIds, noMatch: true };
      }
    } else if (q.employeeId) {
      employeeIds = [q.employeeId];
    }
    return { dateFrom, dateTo, status: q.status, employeeIds, noMatch: false };
  }

  /** Satu query batch untuk profil karyawan (bukan N+1). */
  private async briefsById(records: AttendanceRecord[]): Promise<Map<string, EmployeeBrief>> {
    const ids = [...new Set(records.map((r) => r.employeeId))];
    const briefs = ids.length ? await this.employees.findBriefsByIds(ids) : [];
    return new Map(briefs.map((b) => [b.id, b]));
  }

  async list(q: QueryAttendancesDto): Promise<PaginatedResult<AttendanceAdminView>> {
    const f = await this.resolveFilter(q);
    if (f.noMatch) {
      return {
        data: [],
        meta: { total: 0, page: q.page, limit: q.limit, totalPages: 0 },
      };
    }

    const result = await this.attendances.findAll({
      page: q.page,
      limit: q.limit,
      employeeIds: f.employeeIds,
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
      status: f.status,
    });

    const byId = await this.briefsById(result.data);
    return {
      data: result.data.map((r) => toAttendanceAdminView(r, byId.get(r.employeeId) ?? null)),
      meta: result.meta,
    };
  }

  /**
   * Ringkasan harian. Populasi = karyawan aktif ber-role EMPLOYEE (ADMIN_HRD tidak dihitung),
   * diambil SEKALI dari employee-service. Urutannya sekuensial karena getDailyStats
   * membutuhkan daftar ID tersebut; total tetap dua panggilan RPC.
   */
  async summary(q: QuerySummaryDto): Promise<AttendanceSummaryView> {
    const date = q.date ?? wibDateString();
    if (!isRealDate(date)) {
      throw new BadRequestException('Tanggal tidak valid. Gunakan format YYYY-MM-DD, contoh 2026-11-04.');
    }

    const staff = await this.employees.findActiveStaff();
    const stats = await this.attendances.getDailyStats({
      date,
      employeeIds: staff.map((s) => s.id),
    });

    const present = new Set(stats.presentEmployeeIds);
    const absentEmployees = staff
      .filter((s) => !present.has(s.id))
      .map((s) => ({ id: s.id, fullName: s.fullName, nik: s.nik }));

    return {
      date,
      totalEmployees: staff.length,
      presentCount: stats.presentCount,
      onTimeCount: stats.onTimeCount,
      lateCount: stats.lateCount,
      absentCount: absentEmployees.length,
      absentEmployees,
    };
  }

  /** CSV sesuai filter daftar HRD. Maksimum EXPORT_MAX_ROWS baris; `truncated` menandai data terpotong. */
  async exportCsv(
    q: AttendanceFilterInput,
  ): Promise<{ content: string; filename: string; truncated: boolean }> {
    const f = await this.resolveFilter(q);

    let records: AttendanceRecord[] = [];
    let total = 0;
    if (!f.noMatch) {
      const result = await this.attendances.findAll({
        page: 1,
        limit: EXPORT_MAX_ROWS,
        employeeIds: f.employeeIds,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
        status: f.status,
      });
      records = result.data;
      total = result.meta.total;
    }

    const truncated = total > EXPORT_MAX_ROWS;
    if (truncated) {
      this.logger.warn(`Export dipotong: ${total} baris cocok, hanya ${EXPORT_MAX_ROWS} diekspor`);
    }

    const byId = await this.briefsById(records);
    const rows = records.map((r) => {
      const emp = byId.get(r.employeeId);
      // checkInAt tiba sebagai ISO UTC lewat TCP; ubah ke jam dinding WIB (HH:mm:ss).
      const jam = formatWibIso(new Date(r.checkInAt)).slice(11, 19);
      return [
        emp?.nik ?? '',
        emp?.fullName ?? '',
        r.attendanceDate,
        jam,
        STATUS_LABEL[r.status] ?? r.status,
        r.lateMinutes,
        r.notes ?? '',
      ];
    });

    return {
      // BOM agar Excel membaca UTF-8 dengan benar.
      content: '\uFEFF' + buildCsv(CSV_HEADER, rows),
      filename: `rekap-absensi-wfh-${wibDateString()}.csv`,
      truncated,
    };
  }

  async openPhoto(
    user: AuthUser,
    id: string,
  ): Promise<{ stream: ReadStream; mime: string; size: number }> {
    const record = await this.attendances.findOne(id);
    if (user.role !== Role.ADMIN_HRD && record.employeeId !== user.id) {
      throw new ForbiddenException('You are not allowed to view this photo');
    }
    return this.storage.open(record.photoPath);
  }

  getSettings(): Promise<AttendanceSettingsRecord> {
    return this.attendances.getSettings();
  }

  /** Hanya field yang dikirim diteruskan; validasi lintas field di attendance-service. */
  updateSettings(dto: UpdateAttendanceSettingsDto): Promise<AttendanceSettingsRecord> {
    const patch: UpdateAttendanceSettingsPayload = {};
    if (dto.earliestCheckIn !== undefined) patch.earliestCheckIn = dto.earliestCheckIn;
    if (dto.defaultCutoffTime !== undefined) patch.defaultCutoffTime = dto.defaultCutoffTime;
    if (dto.toleranceMinutes !== undefined) patch.toleranceMinutes = dto.toleranceMinutes;
    if (dto.requireNoteWhenLate !== undefined) patch.requireNoteWhenLate = dto.requireNoteWhenLate;
    if (dto.workingDays !== undefined) patch.workingDays = dto.workingDays;
    return this.attendances.updateSettings(patch);
  }
}
```

## A4. Penjelasan desain

**Di mana cek hash diletakkan:** di `attendance-service`, setelah cek 409 dan semua aturan jam kerja, tepat sebelum `repo.save`.
- **409 tetap pertama.** Karyawan yang sudah absen hari ini harus mendapat pesan "sudah absen", bukan pesan foto, jadi urutan lama tidak bergeser.
- **Setelah aturan jam kerja.** Cek-cek itu murah, dan jika absen memang tidak boleh masuk (hari libur, belum dibuka, catatan wajib kosong), tidak perlu query ke tabel `attendances` yang besar. Query hash hanya jalan untuk request yang sudah lolos semuanya.
- **Di attendance-service, bukan gateway.** Tabel `attendances` dimiliki service ini. Gateway tidak boleh membaca database service lain, sesuai isolasi tanpa FK lintas domain.
- **Rollback tanpa kode baru.** Error 400 dari service naik ke `catch` di `AttendancesService.submit` (gateway), yang memanggil `storage.remove(filename)`.

**Celah kecil:** dua karyawan berbeda yang mengirim foto identik pada milidetik yang sama bisa sama-sama lolos cek, karena index-nya non-unik. Jika ingin menutupnya, ubah `@Index` menjadi `@Index('IDX_attendance_photo_hash', ['photoHash'], { unique: true })`. MySQL mengizinkan banyak `NULL` pada unique index, jadi data lama aman. Tambahkan penanganan `ER_DUP_ENTRY` yang membedakan nama constraint agar pesannya tepat (saat ini semua `ER_DUP_ENTRY` dipetakan ke 409 "sudah absen").

**Menambah kolom:** tabel dibuat lewat TypeORM `synchronize` (`DB_SYNCHRONIZE=true`), jadi **tidak perlu migrasi manual**. Saat `attendance-service` start ulang, TypeORM menjalankan `ALTER TABLE` untuk menambah `photo_hash VARCHAR(64) NULL` dan index `IDX_attendance_photo_hash`. Baris lama otomatis `NULL`, dan `NULL` tidak pernah dianggap duplikat karena cek dilewati jika hash kosong.

Jika `DB_SYNCHRONIZE=false`, jalankan manual:
```sql
ALTER TABLE attendances ADD COLUMN photo_hash VARCHAR(64) NULL;
CREATE INDEX IDX_attendance_photo_hash ON attendances (photo_hash);
```

---

# Bagian B: Frontend, ambil foto dari kamera

## B1. `PhotoDropzone.tsx`

Hanya satu file frontend yang berubah. Props-nya (`file`, `onChange`, `stampName`, `now`, `disabled`) sama persis, jadi `AttendancePage.tsx` dan file lain tidak perlu disentuh.

### `absensi-wfh/frontend/src/components/PhotoDropzone.tsx` (diubah)
```tsx
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { Camera, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/Stamp';
import { formatDateShort, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 3 * 1024 * 1024;
/** Sisi terpanjang hasil jepretan; cukup tajam sebagai bukti, ukuran file tetap kecil. */
const MAX_SIDE = 1280;
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

type CameraStatus = 'idle' | 'starting' | 'live';

interface CameraNotice {
  message: string;
  /** true = kamera tidak bisa dipakai, tampilkan unggah file sebagai gantinya. */
  fallback: boolean;
}

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  stampName: string;
  /** Waktu (sinkron server) untuk stempel pratinjau */
  now: Date;
  disabled?: boolean;
}

function describeCameraError(err: unknown): CameraNotice {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      fallback: true,
      message:
        'Izin kamera ditolak. Izinkan akses kamera lewat ikon gembok di address bar, lalu coba lagi. Atau unggah foto dari perangkat.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      fallback: true,
      message: 'Kamera tidak ditemukan di perangkat ini. Unggah foto dari perangkat sebagai gantinya.',
    };
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return {
      fallback: true,
      message:
        'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi, atau unggah foto dari perangkat.',
    };
  }
  return {
    fallback: true,
    message: 'Kamera tidak dapat dibuka. Coba lagi, atau unggah foto dari perangkat.',
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export function PhotoDropzone({ file, onChange, stampName, now, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Penanda permintaan kamera terbaru; hasil permintaan lama dibuang. */
  const requestRef = useRef(0);

  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [notice, setNotice] = useState<CameraNotice | null>(null);
  const [source, setSource] = useState<'camera' | 'upload'>('camera');
  const [capturing, setCapturing] = useState(false);

  // ---- Pratinjau file ----
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ---- Siklus hidup kamera ----
  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cancelCamera = useCallback(() => {
    requestRef.current += 1;
    stopTracks();
    setStream(null);
    setStatus('idle');
  }, [stopTracks]);

  const startCamera = useCallback(async () => {
    setLocalError(null);

    if (!window.isSecureContext) {
      setNotice({
        fallback: true,
        message:
          'Kamera hanya bisa dipakai lewat HTTPS atau localhost. Unggah foto dari perangkat sebagai gantinya.',
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice({
        fallback: true,
        message: 'Browser ini tidak mendukung akses kamera. Unggah foto dari perangkat sebagai gantinya.',
      });
      return;
    }

    stopTracks();
    const id = ++requestRef.current;
    setNotice(null);
    setStatus('starting');

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (id !== requestRef.current) {
        // Dibatalkan atau komponen ditutup saat menunggu izin: langsung matikan.
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = media;
      setStream(media);
    } catch (err) {
      if (id !== requestRef.current) return;
      setStatus('idle');
      setNotice(describeCameraError(err));
    }
  }, [stopTracks]);

  // Sambungkan stream ke elemen <video> dan pantau kamera yang terputus.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => undefined);

    const track = stream.getVideoTracks()[0];
    const onEnded = () => {
      cancelCamera();
      setNotice({
        fallback: false,
        message: 'Kamera terputus. Buka kembali kamera untuk melanjutkan.',
      });
    };
    track?.addEventListener('ended', onEnded);
    return () => track?.removeEventListener('ended', onEnded);
  }, [stream, cancelCamera]);

  // Matikan kamera saat tab disembunyikan.
  useEffect(() => {
    if (status === 'idle') return;
    const onHide = () => {
      if (!document.hidden) return;
      cancelCamera();
      setNotice({
        fallback: false,
        message: 'Kamera dimatikan karena kamu berpindah tab. Buka kembali kamera untuk melanjutkan.',
      });
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [status, cancelCamera]);

  // Matikan kamera saat komponen ditutup / pindah halaman.
  useEffect(() => {
    return () => {
      requestRef.current += 1;
      stopTracks();
    };
  }, [stopTracks]);

  // ---- Ambil foto ----
  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || capturing) return;
    setCapturing(true);
    setLocalError(null);
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      // Frame digambar apa adanya (tidak dicerminkan) agar hasilnya sesuai kenyataan.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let blob: Blob | null = null;
      for (const quality of JPEG_QUALITIES) {
        blob = await canvasToBlob(canvas, quality);
        if (blob && blob.size <= MAX_BYTES) break;
      }
      if (!blob || blob.size > MAX_BYTES) {
        setLocalError('Foto gagal diproses. Coba ambil ulang.');
        return;
      }

      const captured = new File([blob], `absen-${Date.now()}.jpg`, { type: 'image/jpeg' });
      cancelCamera();
      setSource('camera');
      onChange(captured);
    } catch {
      setLocalError('Foto gagal diproses. Coba ambil ulang.');
    } finally {
      setCapturing(false);
    }
  }

  // ---- Unggah file (fallback) ----
  function pick(list: FileList | null) {
    const candidate = list?.[0];
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      setLocalError('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setLocalError('Ukuran foto maksimal 3 MB.');
      return;
    }
    setLocalError(null);
    setSource('upload');
    onChange(candidate);
  }

  function clear() {
    setLocalError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function retake() {
    if (source === 'camera') {
      clear();
      void startCamera();
    } else {
      inputRef.current?.click();
    }
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) pick(e.dataTransfer.files);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  const showPreview = Boolean(file && previewUrl);
  const showCamera = !showPreview && status !== 'idle';
  const showFallback = !showPreview && !showCamera && notice?.fallback === true;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={(e) => pick(e.target.files)}
      />

      {/* 1. Hasil foto + stempel pratinjau */}
      {showPreview && previewUrl && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-canvas">
          <img
            src={previewUrl}
            alt="Pratinjau foto bukti kerja"
            className="h-full w-full object-cover"
          />

          <Stamp
            label="Pratinjau"
            time={formatTime(now)}
            date={formatDateShort(now)}
            name={stampName}
            className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
          />

          <div className="absolute right-3 top-3 flex gap-2">
            <Button variant="secondary" size="sm" disabled={disabled} onClick={retake}>
              <RotateCcw /> Ulangi
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={clear}
              aria-label="Hapus foto"
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      {/* 2. Kamera aktif */}
      {showCamera && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-ink">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Pratinjau kamera depan"
            onPlaying={() => setStatus((s) => (s === 'starting' ? 'live' : s))}
            className="h-full w-full -scale-x-100 object-cover"
          />

          {status === 'starting' && (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink text-center text-white"
            >
              <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />
              <p className="text-sm font-medium">Menyalakan kamera…</p>
              <p className="px-6 text-xs text-white/70">
                Jika browser meminta izin, pilih &ldquo;Izinkan&rdquo;.
              </p>
            </div>
          )}

          <div className="absolute right-3 top-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={cancelCamera}
              disabled={capturing}
              aria-label="Tutup kamera"
            >
              <X />
            </Button>
          </div>

          {status === 'live' && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <Button onClick={capture} disabled={capturing || disabled}>
                {capturing ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Camera />
                )}
                {capturing ? 'Memproses…' : 'Ambil foto'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 3. Kamera tidak bisa dipakai: unggah file seperti sebelumnya */}
      {showFallback && (
        <div className="space-y-3">
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {notice?.message}
          </div>

          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label="Pilih foto bukti kerja"
            onClick={() => !disabled && inputRef.current?.click()}
            onKeyDown={onKeyDown}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center transition-colors hover:border-accent active:bg-accent-soft/40',
              dragging && 'border-accent bg-accent-soft',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <ImagePlus className="size-7 text-accent" aria-hidden />
            <p className="text-sm font-medium text-ink">
              Tarik foto ke sini atau pilih dari perangkat
            </p>
            <p className="text-xs text-muted">JPG, PNG, atau WebP, maksimal 3 MB</p>
          </div>

          <Button variant="secondary" size="sm" onClick={() => void startCamera()} disabled={disabled}>
            <Camera /> Coba kamera lagi
          </Button>
        </div>
      )}

      {/* 4. Awal: belum ada foto, kamera belum dibuka */}
      {!showPreview && !showCamera && !showFallback && (
        <div className="space-y-3">
          {notice && (
            <div
              role="status"
              className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-ink"
            >
              {notice.message}
            </div>
          )}
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center">
            <Camera className="size-7 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium text-ink">Ambil foto bukti kerja dari kamera</p>
              <p className="mt-1 text-xs text-muted">
                Kamera depan akan dipakai. Pastikan wajah dan ruang kerjamu terlihat jelas.
              </p>
            </div>
            <Button onClick={() => void startCamera()} disabled={disabled}>
              <Camera /> Buka kamera
            </Button>
          </div>
        </div>
      )}

      {showPreview && (
        <p className="mt-2 text-xs text-muted">
          Stempel di atas hanya pratinjau. Waktu absen resmi dicatat server saat kamu menekan
          kirim.
        </p>
      )}
      {localError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {localError}
        </p>
      )}
    </div>
  );
}
```

## B2. Perilaku yang perlu diketahui
- **Kamera dibuka lewat tombol "Buka kamera"**, tidak otomatis saat halaman dimuat. Dengan begitu, permintaan izin tidak muncul tiba-tiba, dan karyawan yang diblokir aturan jam kerja tidak diminta izin kamera.
- **Unggah file hanya muncul sebagai fallback**, yaitu saat kamera ditolak, tidak ada, dipakai aplikasi lain, atau bukan HTTPS/localhost. Dalam kondisi normal hanya jalur kamera yang tampil.
- **Hasil jepretan:** sisi terpanjang maksimal 1280 px, JPEG kualitas 0,85. Jika masih lebih dari 3 MB, kualitas diturunkan ke 0,7 lalu 0,55. Preview kamera dicerminkan seperti cermin, tetapi file yang tersimpan tidak dicerminkan.
- **Kamera dimatikan** saat foto diambil, saat tombol X ditekan, saat tab disembunyikan, saat komponen unmount atau pindah rute, dan saat perangkat kamera terputus. Jika menutup atau pindah halaman ketika izin belum dijawab, stream yang datang belakangan langsung dimatikan.
- **"Ulangi":** untuk foto dari kamera, tombol ini membuka kamera lagi. Untuk foto hasil unggahan, tombol ini membuka pemilih file.
- **Pesan "Terlambat" dan aturan catatan wajib** tidak disentuh dan tetap ditangani `AttendancePage`.
- **Sinergi dengan deteksi duplikat:** setiap jepretan kamera menghasilkan byte JPEG yang berbeda, jadi foto kamera yang sah tidak pernah terkena penolakan duplikat. Pesan duplikat dari server (`Foto ini sudah pernah digunakan. Ambil foto baru.`) tampil di kotak merah lewat `getErrorMessage` di `AttendancePage`, tanpa perubahan kode.

---

# Menjalankan

```bash
# Backend (dari absensi-wfh/backend)
npm run typecheck
# Restart attendance-service dulu (agar kolom photo_hash terbentuk), lalu api-gateway:
#   npm run start:dev   (atau start:attendance lalu start:gateway)

# Frontend (dari absensi-wfh/frontend)
npm run typecheck && npm run build
npm run dev                          # http://localhost:5173
```

Verifikasi kolom di MySQL:
```bash
docker exec -it absensi-mysql mysql -uabsensi_user -pabsensi_pass absensi_wfh \
  -e "SHOW COLUMNS FROM attendances LIKE 'photo_hash'; SHOW INDEX FROM attendances WHERE Key_name='IDX_attendance_photo_hash';"
```

---

# Skenario uji

## Backend (deteksi duplikat)

Foto dari kamera selalu berbeda byte-nya, jadi untuk mengirim file yang *sama* pakai `curl`. Jalankan dari folder `absensi-wfh/backend`.

Persiapan:
```bash
API=http://localhost:3000/api
TOKEN_BUDI=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"budi@company.test","password":"Karyawan123!"}' | jq -r .accessToken)
TOKEN_ADMIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@company.test","password":"Admin123!"}' | jq -r .accessToken)

# Akun karyawan kedua (abaikan 409 jika sudah ada)
curl -s -X POST $API/employees -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' \
  -d '{"nik":"2000000099","fullName":"Sari Uji","email":"sari@company.test","password":"Karyawan123!","position":"Staff","role":"EMPLOYEE"}'
TOKEN_SARI=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"sari@company.test","password":"Karyawan123!"}' | jq -r .accessToken)

ls uploads | wc -l     # catat jumlah awal (N0)
```
Siapkan `a.jpg` dan `b.jpg` (dua JPEG berbeda, masing-masing di bawah 3 MB). Jika hari ini bukan hari kerja atau jam absen belum dibuka, ubah dulu di Pengaturan absensi. Login ke MySQL dengan `docker exec -it absensi-mysql mysql -uabsensi_user -pabsensi_pass absensi_wfh`. Semua tabel berada di satu database `absensi_wfh`, jadi subquery ke `employees` di bawah valid.

1. **Foto baru berhasil.** Budi mengirim `a.jpg`:
   ```bash
   curl -s -X POST $API/attendances -H "Authorization: Bearer $TOKEN_BUDI" -F photo=@a.jpg
   ```
   Hasilnya 201. Jumlah file di `uploads` menjadi N0+1, dan `SELECT photo_hash FROM attendances ORDER BY created_at DESC LIMIT 1;` berisi 64 karakter hex. Cocokkan dengan `sha256sum a.jpg`.

2. **Urutan cek: 409 tetap lebih dulu.** Budi mengirim `a.jpg` lagi di hari yang sama. Hasilnya **409** "Attendance already submitted today", bukan 400. Jumlah file di `uploads` tetap N0+1.

3. **Foto yang sama dari akun lain ditolak.** Sari mengirim `a.jpg`:
   ```bash
   curl -s -X POST $API/attendances -H "Authorization: Bearer $TOKEN_SARI" -F photo=@a.jpg
   ```
   Hasilnya **400** `"Foto ini sudah pernah digunakan. Ambil foto baru."`. Jumlah file di `uploads` tetap N0+1 (file yang ditolak dihapus). Di halaman absensi (UI), pesan yang sama tampil di kotak merah.

4. **Foto yang sama dari akun yang sama di hari berbeda ditolak.** Geser tanggal absen Budi hari ini ke kemarin supaya cek 409 tidak aktif, tetapi hash `a.jpg` tetap tersimpan:
   ```sql
   UPDATE attendances
      SET attendance_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    WHERE employee_id = (SELECT id FROM employees WHERE email='budi@company.test')
      AND attendance_date = CURDATE();
   ```
   Lalu Budi mengirim `a.jpg` lagi. Hasilnya **400** "Foto ini sudah pernah digunakan. Ambil foto baru." (bukan 409, karena baris hari ini sudah tidak ada). Setelah itu Budi mengirim `b.jpg` dan hasilnya 201.

5. **Hash ikut terhapus bersama barisnya.** Hapus baris absen Sari hari ini (jika ada), atau baris Budi yang berisi `b.jpg`:
   ```sql
   DELETE FROM attendances WHERE attendance_date = CURDATE() AND employee_id = (SELECT id FROM employees WHERE email='budi@company.test');
   ```
   Kirim ulang `b.jpg` dari akun yang sama. Hasilnya harus **201**, karena hash `b.jpg` sudah hilang bersama barisnya. (Jika Anda menghapus fisik file di `uploads`, itu tidak memengaruhi cek ini; cek hanya melihat kolom `photo_hash`.)

6. **File yang ditolak tidak meninggalkan sisa.** Setelah skenario 3 dan 4, jalankan `ls uploads | wc -l`. Jumlahnya harus sama dengan jumlah baris `attendances` yang punya foto (`SELECT COUNT(*) FROM attendances;`), tidak lebih. Catat jumlah file sebelum dan sesudah request yang ditolak: harus tidak berubah. Cek juga log gateway, tidak ada warning "Gagal menghapus".

7. **Data lama tetap jalan.** Baris lama dengan `photo_hash IS NULL` tidak memicu penolakan. Kirim foto baru dari akun yang pernah absen sebelum fitur ini, hasilnya 201.

### PENTING: dampak pada skrip uji fase sebelumnya
Skrip uji di fase 5B, 5.5-A, dan 5.5-B/C memakai **satu file foto yang sama** (`foto.jpg` atau `ok.png`) untuk beberapa karyawan pada hari yang sama. Setelah fitur ini, pengiriman kedua dan seterusnya dari karyawan lain akan ditolak 400 (foto duplikat). Perbaiki dengan membuat file unik per pengiriman. Ganti helper `absen()` di skrip uji dengan:
```bash
absen() {   # pemakaian: absen $TOKEN ["catatan"]
  local f; f=$(mktemp /tmp/foto-XXXXXX.jpg)
  cp foto.jpg "$f"; printf '%s' "$RANDOM$RANDOM" >> "$f"    # tambah byte acak; JPEG tetap valid
  curl -s -X POST $API/attendances -H "Authorization: Bearer $1" -F photo=@"$f" ${2:+-F "notes=$2"}; echo
  rm -f "$f"
}
```
Untuk skrip yang memakai `ok.png` (PNG 1x1), tambahkan byte acak dengan cara yang sama pada salinan sementara. Magic bytes di awal file tidak berubah, jadi validasi tipe gambar tetap lolos.

## Frontend (kamera)

Jalankan lewat `http://localhost:5173` atau HTTPS. Alamat `http://192.168.x.x` tidak dihitung aman oleh browser.

1. **Kamera diizinkan:** login sebagai `budi@company.test`, klik **Buka kamera**, lalu klik **Izinkan**. Spinner "Menyalakan kamera…" muncul sebentar, kemudian preview tampil dan tombol **Ambil foto** muncul. Klik tombol itu. Preview berubah menjadi foto dengan stempel "Pratinjau". Lampu kamera mati, dan ukuran file di tab Network saat kirim di bawah 3 MB.
2. **Kamera ditolak:** di pengaturan situs, blok kamera untuk localhost, lalu klik **Buka kamera**. Pesan merah "Izin kamera ditolak…" muncul beserta area unggah file dan tombol **Coba kamera lagi**. Unggah JPG lalu kirim, dan harus berhasil seperti sebelumnya. Unggah PDF atau file di atas 3 MB harus menampilkan pesan error format atau ukuran.
3. **Tidak tersedia:** buka lewat IP LAN dengan HTTP biasa, atau nonaktifkan kamera di DevTools (Sensors). Pesan "hanya bisa dipakai lewat HTTPS atau localhost" atau "Kamera tidak ditemukan" harus muncul bersama fallback unggah.
4. **Ambil ulang:** setelah foto diambil, klik **Ulangi**. Kamera menyala lagi dan foto lama hilang. Ambil foto baru, lalu coba juga tombol X (Hapus foto), yang harus kembali ke tampilan awal.
5. **Kirim:** isi catatan jika diwajibkan, lalu klik **Kirim absen**. Kartu "Absen hari ini sudah tercatat" muncul, dan foto muncul di Riwayat sebagai JPEG.
6. **Pindah tab saat kamera aktif:** buka kamera sampai preview tampil, lalu pindah ke tab lain. Lampu kamera harus mati. Saat kembali, muncul info biru "Kamera dimatikan karena kamu berpindah tab…" dan tombol **Buka kamera** tersedia lagi.
7. **Pindah halaman saat kamera aktif:** buka kamera, lalu klik menu atau tombol Keluar. Lampu kamera harus mati.
8. **Tutup saat menunggu izin:** klik **Buka kamera**, jangan jawab prompt izin, lalu pindah halaman. Setelah itu jawab izin. Lampu kamera tidak boleh menyala.
9. **Kamera terputus:** cabut webcam USB saat preview aktif. Muncul info "Kamera terputus…" dan tidak ada error di console.
10. **Duplikat lewat UI (opsional):** unggah file yang sama dari dua akun lewat jalur fallback (blok kamera dulu). Akun kedua harus melihat pesan merah "Foto ini sudah pernah digunakan. Ambil foto baru."

---

# Daftar file

**Backend (diubah, 4):**
```
libs/common/src/interfaces/attendance.interface.ts
apps/attendance-service/src/attendances/entities/attendance.entity.ts
apps/attendance-service/src/attendances/attendances.service.ts
apps/api-gateway/src/attendances/attendances.service.ts
```

**Frontend (diubah, 1):**
```
components/PhotoDropzone.tsx
```

**Dibuat:** tidak ada. **Tidak berubah:** `AttendanceServiceClient`, `AttendancePage.tsx`, `Stamp.tsx`, `api.ts`, `format.ts`.

---

# Catatan dan batasan

- Hash SHA-256 hanya menangkap file yang **byte-nya identik**. Foto yang di-screenshot, dikompres ulang, atau diedit sedikit akan punya hash berbeda. Deteksi kemiripan visual butuh perceptual hashing, yang di luar lingkup fase ini.
- Larangan unggah file di sisi frontend hanya mengubah alur UI. Karyawan yang paham teknis tetap bisa mengirim file lewat request manual (curl atau sejenisnya). Jika dibutuhkan penegakan yang sebenarnya, itu perlu pemeriksaan di server, misalnya metadata atau token sesi kamera.
- Cek hash non-unik sengaja dipilih sesuai permintaan (lihat bagian A4 untuk cara menutup celah balapan jika diperlukan).
