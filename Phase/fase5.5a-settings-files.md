# Fase 5.5-A (Backend): Pengaturan Absensi dan Status Keterlambatan (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Fase 5A dan 5B (`fase5-microservices-files.md` dan `fase5b-attendance-files.md`) sudah terpasang dan lulus tes. Fase ini menambah pengaturan jam kerja global (satu baris di tabel `attendance_settings`), aturan absen (hari kerja, jam mulai, toleransi, catatan wajib saat terlambat), serta kolom `status` dan `late_minutes` pada setiap absensi. Buat setiap file baru pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya. File yang sudah ada dan ditandai "ditimpa penuh" diganti seluruh isinya. Buat folder yang belum ada. Frontend belum diubah di fase ini (lihat "Langkah berikutnya").

Catatan penting:
- Semua path relatif terhadap `absensi-wfh/backend/`.
- Tidak ada dependensi npm baru, tidak ada env baru, dan tidak ada migrasi manual. `DB_SYNCHRONIZE=true` menambah kolom `status` dan `late_minutes` serta membuat tabel `attendance_settings`.
- Kode ditulis tanpa dijalankan. Setelah semua file dibuat, jalankan `npm run typecheck` dan perbaiki error compile bila ada tanpa mengubah perilaku yang dijelaskan di sini, lalu uji dengan bagian "Skenario uji".
- Penyimpangan kecil dari rencana: cek lintas field (`earliestCheckIn < defaultCutoffTime`) dijalankan di **attendance-service**, bukan di gateway. Penggabungan nilai lama dengan patch memang terjadi di sana, jadi hasilnya sama (400 dengan pesan Indonesia), lebih atomik, dan tanpa RPC tambahan. Gateway tetap memvalidasi bentuk input lewat class-validator.

Aturan bisnis ringkas:
- Terlambat jika menit sekarang (WIB) > `defaultCutoffTime` + `toleranceMinutes`. Perbandingan per menit, detik diabaikan.
- `lateMinutes` dihitung dari `defaultCutoffTime` (bukan dari batas toleransi). Tepat waktu berarti 0.
- `status` dan `lateMinutes` disimpan saat absen dan tidak berubah walau pengaturan diubah kemudian.
- Urutan cek saat absen: duplikat (409), hari kerja (400), `earliestCheckIn` (400), catatan wajib saat terlambat (400).
- Default pengaturan longgar: `earliestCheckIn 00:00`, `defaultCutoffTime 08:00`, `toleranceMinutes 15`, `requireNoteWhenLate false`, `workingDays [0..6]`.

---

## 1. `libs/common`

### `absensi-wfh/backend/libs/common/src/enums/attendance-status.enum.ts` (baru)
```ts
export enum AttendanceStatus {
  ON_TIME = 'ON_TIME',
  LATE = 'LATE',
}
```

### `absensi-wfh/backend/libs/common/src/constants/rpc.constants.ts` (ditimpa penuh)
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
  GET_SETTINGS: 'attendances.getSettings',
  UPDATE_SETTINGS: 'attendances.updateSettings',
} as const;

export const TIMEZONE = 'Asia/Jakarta';
```

### `absensi-wfh/backend/libs/common/src/interfaces/attendance.interface.ts` (ditimpa penuh)
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
}

/** Dipakai oleh /attendances (HRD) dan /attendances/my (employeeIds = [id dari token]). */
export interface ListAttendancesPayload {
  page: number;
  limit: number;
  employeeIds?: string[];
  dateFrom?: string;
  dateTo?: string;
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
```

### `absensi-wfh/backend/libs/common/src/utils/wib.util.ts` (ditimpa penuh)
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

/** Menit sejak 00:00 WIB (0-1439). Detik diabaikan, sama dengan yang tampil di jam HH:mm. */
export function wibMinutesOfDay(date: Date = new Date()): number {
  const p = wibParts(date);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Hari dalam seminggu menurut kalender WIB: 0 = Minggu ... 6 = Sabtu. */
export function wibDayOfWeek(date: Date = new Date()): number {
  return new Date(`${wibDateString(date)}T00:00:00Z`).getUTCDay();
}
```

### `absensi-wfh/backend/libs/common/src/utils/attendance-settings.util.ts` (baru)
```ts
import { AttendanceSettingsRecord } from '../interfaces/attendance.interface';

/** HH:mm 24 jam, 00:00 - 23:59. */
export const HM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Default longgar: tidak ada pembatasan jam mulai/hari, catatan tidak wajib. */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsRecord = {
  earliestCheckIn: '00:00',
  defaultCutoffTime: '08:00',
  toleranceMinutes: 15,
  requireNoteWhenLate: false,
  workingDays: [0, 1, 2, 3, 4, 5, 6],
};

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** Urut Senin..Minggu agar mudah dibaca, mis. "Senin, Selasa, Rabu". */
export function formatWorkingDays(days: number[]): string {
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAY_NAMES_ID[d])
    .join(', ');
}

/** Mengembalikan daftar pesan galat (kosong = valid). Dipakai pada nilai GABUNGAN. */
export function validateAttendanceSettings(s: AttendanceSettingsRecord): string[] {
  const errors: string[] = [];

  const earliestOk = typeof s.earliestCheckIn === 'string' && HM_REGEX.test(s.earliestCheckIn);
  const cutoffOk = typeof s.defaultCutoffTime === 'string' && HM_REGEX.test(s.defaultCutoffTime);

  if (!earliestOk) errors.push('earliestCheckIn harus berformat HH:mm, contoh 06:00');
  if (!cutoffOk) errors.push('defaultCutoffTime harus berformat HH:mm, contoh 08:00');

  if (!Number.isInteger(s.toleranceMinutes) || s.toleranceMinutes < 0 || s.toleranceMinutes > 120) {
    errors.push('toleranceMinutes harus bilangan bulat 0 sampai 120');
  }

  if (typeof s.requireNoteWhenLate !== 'boolean') {
    errors.push('requireNoteWhenLate harus berupa true atau false');
  }

  const days = s.workingDays;
  const daysOk =
    Array.isArray(days) &&
    days.length >= 1 &&
    days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(days).size === days.length;
  if (!daysOk) {
    errors.push(
      'workingDays harus berisi minimal 1 hari, berupa angka 0 (Minggu) sampai 6 (Sabtu), tanpa duplikat',
    );
  }

  if (earliestOk && cutoffOk && hmToMinutes(s.earliestCheckIn) >= hmToMinutes(s.defaultCutoffTime)) {
    errors.push(
      'Jam mulai absen (earliestCheckIn) harus lebih awal dari batas jam masuk (defaultCutoffTime)',
    );
  }

  return errors;
}
```

### `absensi-wfh/backend/libs/common/src/index.ts` (ditimpa penuh)
```ts
export * from './enums/role.enum';
export * from './enums/attendance-status.enum';
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
export * from './utils/attendance-settings.util';
```

---

## 2. `attendance-service`

### `absensi-wfh/backend/apps/attendance-service/src/attendances/entities/attendance-settings.entity.ts` (baru)
```ts
import { Column, Entity, PrimaryColumn } from 'typeorm';

export const ATTENDANCE_SETTINGS_ID = 1;

/** Konfigurasi global, selalu tepat satu baris (id = 1). */
@Entity({ name: 'attendance_settings' })
export class AttendanceSettings {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'earliest_check_in', type: 'varchar', length: 5 })
  earliestCheckIn: string;

  @Column({ name: 'default_cutoff_time', type: 'varchar', length: 5 })
  defaultCutoffTime: string;

  @Column({ name: 'tolerance_minutes', type: 'int' })
  toleranceMinutes: number;

  @Column({ name: 'require_note_when_late', type: 'boolean' })
  requireNoteWhenLate: boolean;

  /** 0 = Minggu ... 6 = Sabtu */
  @Column({ name: 'working_days', type: 'json' })
  workingDays: number[];

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/entities/attendance.entity.ts` (ditimpa penuh)
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

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendance-settings.service.ts` (baru)
```ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AttendanceSettingsRecord,
  DEFAULT_ATTENDANCE_SETTINGS,
  hmToMinutes,
  UpdateAttendanceSettingsPayload,
  validateAttendanceSettings,
} from '@app/common';
import {
  ATTENDANCE_SETTINGS_ID,
  AttendanceSettings,
} from './entities/attendance-settings.entity';

const toRecord = (s: AttendanceSettings): AttendanceSettingsRecord => ({
  earliestCheckIn: s.earliestCheckIn,
  defaultCutoffTime: s.defaultCutoffTime,
  toleranceMinutes: s.toleranceMinutes,
  requireNoteWhenLate: s.requireNoteWhenLate,
  workingDays: s.workingDays,
});

@Injectable()
export class AttendanceSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceSettingsService.name);

  constructor(
    @InjectRepository(AttendanceSettings)
    private readonly repo: Repository<AttendanceSettings>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Seed idempoten. Backfill status absensi lama HANYA berjalan saat baris
   * pengaturan dibuat pertama kali (satu transaksi), jadi restart service
   * tidak pernah menimpa status yang sudah tersimpan.
   * check_in_at disimpan sebagai jam dinding WIB (TypeORM timezone +07:00),
   * sehingga HOUR()/MINUTE() langsung berisi waktu WIB.
   */
  async onModuleInit(): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(AttendanceSettings);
      const exists = await repo.findOneBy({ id: ATTENDANCE_SETTINGS_ID });
      if (exists) return;

      const d = DEFAULT_ATTENDANCE_SETTINGS;
      await repo.insert({
        id: ATTENDANCE_SETTINGS_ID,
        earliestCheckIn: d.earliestCheckIn,
        defaultCutoffTime: d.defaultCutoffTime,
        toleranceMinutes: d.toleranceMinutes,
        requireNoteWhenLate: d.requireNoteWhenLate,
        workingDays: d.workingDays,
        updatedAt: new Date(),
      });

      const cutoff = hmToMinutes(d.defaultCutoffTime);
      const limit = cutoff + d.toleranceMinutes;
      const minuteOfDay = 'HOUR(check_in_at) * 60 + MINUTE(check_in_at)';
      await em.query(
        `UPDATE attendances
            SET status = IF(${minuteOfDay} > ?, 'LATE', 'ON_TIME'),
                late_minutes = IF(${minuteOfDay} > ?, ${minuteOfDay} - ?, 0)`,
        [limit, limit, cutoff],
      );
      this.logger.log(
        'Pengaturan absensi default dibuat dan status absensi lama di-backfill (sekali jalan)',
      );
    });
  }

  private async load(): Promise<AttendanceSettings> {
    const row = await this.repo.findOneBy({ id: ATTENDANCE_SETTINGS_ID });
    if (!row) {
      throw new InternalServerErrorException('Pengaturan absensi belum diinisialisasi');
    }
    return row;
  }

  async get(): Promise<AttendanceSettingsRecord> {
    return toRecord(await this.load());
  }

  async update(patch: UpdateAttendanceSettingsPayload): Promise<AttendanceSettingsRecord> {
    const p = patch ?? {};
    const hasChange = Object.values(p).some((v) => v !== undefined && v !== null);
    if (!hasChange) {
      throw new BadRequestException('Tidak ada field pengaturan yang dikirim untuk diubah');
    }

    const row = await this.load();
    const current = toRecord(row);
    // `??` mempertahankan nilai 0 dan false yang sah.
    const next: AttendanceSettingsRecord = {
      earliestCheckIn: p.earliestCheckIn ?? current.earliestCheckIn,
      defaultCutoffTime: p.defaultCutoffTime ?? current.defaultCutoffTime,
      toleranceMinutes: p.toleranceMinutes ?? current.toleranceMinutes,
      requireNoteWhenLate: p.requireNoteWhenLate ?? current.requireNoteWhenLate,
      workingDays: p.workingDays ?? current.workingDays,
    };

    // Validasi nilai GABUNGAN (termasuk aturan lintas field).
    const errors = validateAttendanceSettings(next);
    if (errors.length > 0) throw new BadRequestException(errors.join('; '));

    Object.assign(row, next, {
      workingDays: [...next.workingDays].sort((a, b) => a - b),
      updatedAt: new Date(),
    });
    return toRecord(await this.repo.save(row));
  }
}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.service.ts` (ditimpa penuh)
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

    try {
      const saved = await this.repo.save(
        this.repo.create({
          employeeId: p.employeeId,
          checkInAt: now,
          attendanceDate,
          photoPath: p.photoPath,
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

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.controller.ts` (ditimpa penuh)
```ts
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AllRpcExceptionsFilter,
  AttendancePattern,
  CreateAttendancePayload,
  ListAttendancesPayload,
  UpdateAttendanceSettingsPayload,
} from '@app/common';
import { AttendanceSettingsService } from './attendance-settings.service';
import { AttendancesService } from './attendances.service';

@Controller()
@UseFilters(AllRpcExceptionsFilter)
export class AttendancesController {
  constructor(
    private readonly attendances: AttendancesService,
    private readonly settings: AttendanceSettingsService,
  ) {}

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

  @MessagePattern(AttendancePattern.GET_SETTINGS)
  getSettings() {
    return this.settings.get();
  }

  @MessagePattern(AttendancePattern.UPDATE_SETTINGS)
  updateSettings(@Payload() payload: UpdateAttendanceSettingsPayload) {
    return this.settings.update(payload);
  }
}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.module.ts` (ditimpa penuh)
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceSettingsService } from './attendance-settings.service';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { AttendanceSettings } from './entities/attendance-settings.entity';
import { Attendance } from './entities/attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, AttendanceSettings])],
  controllers: [AttendancesController],
  providers: [AttendancesService, AttendanceSettingsService],
})
export class AttendancesModule {}
```

### `absensi-wfh/backend/apps/attendance-service/src/attendance-service.module.ts` (ditimpa penuh)
```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions, validateAttendanceServiceEnv } from '@app/common';
import { AttendancesModule } from './attendances/attendances.module';
import { AttendanceSettings } from './attendances/entities/attendance-settings.entity';
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
        buildTypeOrmOptions(config, [Attendance, AttendanceSettings]),
    }),
    AttendancesModule,
  ],
})
export class AttendanceServiceModule {}
```

---

## 3. `api-gateway`

### `absensi-wfh/backend/apps/api-gateway/src/clients/attendance-service.client.ts` (ditimpa penuh)
```ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  ATTENDANCE_SERVICE,
  AttendancePattern,
  AttendanceRecord,
  AttendanceSettingsRecord,
  CreateAttendancePayload,
  ListAttendancesPayload,
  PaginatedResult,
  UpdateAttendanceSettingsPayload,
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

  getSettings() {
    return this.call<AttendanceSettingsRecord, Record<string, never>>(
      AttendancePattern.GET_SETTINGS,
      {},
    );
  }

  updateSettings(payload: UpdateAttendanceSettingsPayload) {
    return this.call<AttendanceSettingsRecord, UpdateAttendanceSettingsPayload>(
      AttendancePattern.UPDATE_SETTINGS,
      payload,
    );
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendance.mapper.ts` (ditimpa penuh)
```ts
import { AttendanceRecord, AttendanceStatus, EmployeeBrief } from '@app/common';

export interface AttendanceView {
  id: string;
  employeeId: string;
  attendanceDate: string;
  createdAt: Date | string;
  /** KOMPAT FRONTEND: frontend membaca checkInAt (sama dengan createdAt). */
  checkInAt: Date | string;
  photoUrl: string;
  notes: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
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
    status: r.status,
    lateMinutes: r.lateMinutes,
  };
}

export function toAttendanceAdminView(
  r: AttendanceRecord,
  employee: EmployeeBrief | null,
): AttendanceAdminView {
  return { ...toAttendanceView(r), employee };
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/dto/attendance.dto.ts` (ditimpa penuh)
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus, HM_REGEX } from '@app/common';

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

/** PATCH parsial: kirim hanya field yang ingin diubah. */
export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ example: '06:00', description: 'Jam mulai absen diperbolehkan (HH:mm WIB)' })
  @IsOptional()
  @IsString({ message: 'earliestCheckIn harus berformat HH:mm, contoh 06:00' })
  @Matches(HM_REGEX, { message: 'earliestCheckIn harus berformat HH:mm, contoh 06:00' })
  earliestCheckIn?: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Batas jam masuk (HH:mm WIB)' })
  @IsOptional()
  @IsString({ message: 'defaultCutoffTime harus berformat HH:mm, contoh 08:00' })
  @Matches(HM_REGEX, { message: 'defaultCutoffTime harus berformat HH:mm, contoh 08:00' })
  defaultCutoffTime?: string;

  @ApiPropertyOptional({ example: 15, minimum: 0, maximum: 120 })
  @IsOptional()
  @IsInt({ message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  @Min(0, { message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  @Max(120, { message: 'toleranceMinutes harus bilangan bulat 0 sampai 120' })
  toleranceMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'requireNoteWhenLate harus berupa true atau false' })
  requireNoteWhenLate?: boolean;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: '0 = Minggu ... 6 = Sabtu, tanpa duplikat, minimal 1 hari',
  })
  @IsOptional()
  @IsArray({ message: 'workingDays harus berupa array angka 0 sampai 6' })
  @ArrayMinSize(1, { message: 'workingDays harus berisi minimal 1 hari' })
  @ArrayMaxSize(7, { message: 'workingDays maksimal 7 hari' })
  @ArrayUnique({ message: 'workingDays tidak boleh berisi hari yang sama dua kali' })
  @IsInt({ each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  @Min(0, { each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  @Max(6, { each: true, message: 'workingDays hanya boleh berisi angka 0 (Minggu) sampai 6 (Sabtu)' })
  workingDays?: number[];
}

export class AttendanceSettingsResponseDto {
  @ApiProperty({ example: '00:00' }) earliestCheckIn: string;
  @ApiProperty({ example: '08:00' }) defaultCutoffTime: string;
  @ApiProperty({ example: 15 }) toleranceMinutes: number;
  @ApiProperty({ example: false }) requireNoteWhenLate: boolean;
  @ApiProperty({ type: [Number], example: [0, 1, 2, 3, 4, 5, 6] }) workingDays: number[];
}

export class AttendanceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ example: '2026-11-04' }) attendanceDate: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() checkInAt: string;
  @ApiProperty({ example: '/api/attendances/<id>/photo' }) photoUrl: string;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ enum: AttendanceStatus, enumName: 'AttendanceStatus' })
  status: AttendanceStatus;
  @ApiProperty({ example: 0, description: 'Menit terlambat dari batas jam masuk dasar' })
  lateMinutes: number;
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

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.service.ts` (ditimpa penuh)
```ts
import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ReadStream } from 'fs';
import {
  AttendanceSettingsRecord,
  AuthUser,
  PaginatedResult,
  Role,
  UpdateAttendanceSettingsPayload,
} from '@app/common';
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
  UpdateAttendanceSettingsDto,
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
        this.logger.warn(`Timeout saat menyimpan absensi; file ${filename} dipertahankan`);
      } else {
        await this.storage.remove(filename); // rollback file (termasuk saat 400 aturan jam kerja)
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

  async list(q: QueryAttendancesDto): Promise<PaginatedResult<AttendanceAdminView>> {
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

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.controller.ts` (ditimpa penuh)
Rute statis `settings` harus tetap dideklarasikan sebelum `:id/photo`.
```ts
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
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
  AttendanceSettingsResponseDto,
  CreateAttendanceDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
  UpdateAttendanceSettingsDto,
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

  @Get(['my', 'me'])
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceListResponseDto })
  mine(@CurrentUser() user: AuthUser, @Query() query: QueryMyAttendancesDto) {
    return this.attendances.mine(user, query);
  }

  /** Tanpa @Roles: semua user login (EMPLOYEE dan ADMIN_HRD), sama seperti endpoint photo. */
  @Get('settings')
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  getSettings() {
    return this.attendances.getSettings();
  }

  @Patch('settings')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  updateSettings(@Body() dto: UpdateAttendanceSettingsDto) {
    return this.attendances.updateSettings(dto);
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

---

## Cara menjalankan

Tidak ada env baru dan tidak ada migrasi manual. Setelah semua file dibuat:

```bash
cd absensi-wfh/backend
npm run typecheck                     # harus 0 error
docker compose up -d                  # MySQL (absensi-mysql)
# Restart attendance-service dan api-gateway (npm run start:dev, atau start:attendance lalu start:gateway).
# Urutan: attendance-service dulu (menyiapkan skema dan seed), lalu api-gateway.
```

Cek log attendance-service saat start pertama. Harus ada baris: `Pengaturan absensi default dibuat dan status absensi lama di-backfill (sekali jalan)`. Pada restart berikutnya baris itu tidak muncul lagi.

Verifikasi DB:
```bash
docker exec -i absensi-mysql mysql -uabsensi_user -pabsensi_pass absensi_wfh -e "
SELECT * FROM attendance_settings;
SELECT attendance_date, TIME(check_in_at) AS jam, status, late_minutes FROM attendances ORDER BY check_in_at DESC LIMIT 10;"
```
Baris lama dengan jam masuk 08:16 atau lebih harus berstatus `LATE`, dan `late_minutes` sama dengan jam masuk dikurangi 08:00. Baris dengan jam masuk sampai 08:15 berstatus `ON_TIME`.

---

## Skenario uji

Server memakai jam asli, jadi tes dilakukan dengan memajukan atau memundurkan `defaultCutoffTime` relatif terhadap jam sekarang. Jangan jalankan mendekati tengah malam WIB, karena `earliestCheckIn` harus lebih awal dari cutoff.

Persiapan (butuh `jq` dan GNU `date`, serta `foto.jpg` yang valid di folder kerja):
```bash
API=http://localhost:3000/api
login() { curl -s $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .accessToken; }
ADMIN=$(login admin@company.test 'Admin123!')
BUDI=$(login budi@company.test 'Karyawan123!')

wib()   { TZ=Asia/Jakarta date -d "$1" +%H:%M; }          # contoh: wib "-30 min"
patch() { curl -s -X PATCH $API/attendances/settings -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "$1"; echo; }
absen() { curl -s -X POST $API/attendances -H "Authorization: Bearer $1" -F photo=@foto.jpg ${2:+-F "notes=$2"}; echo; }
reset() { docker exec -i absensi-mysql mysql -uabsensi_user -pabsensi_pass absensi_wfh \
          -e "DELETE FROM attendances WHERE attendance_date='$(TZ=Asia/Jakarta date +%F)'"; }
```

**0. Default longgar dan akses baca**
```bash
curl -s $API/attendances/settings -H "Authorization: Bearer $BUDI"  | jq
curl -s $API/attendances/settings -H "Authorization: Bearer $ADMIN" | jq
```
Keduanya 200 dengan `earliestCheckIn "00:00"`, `defaultCutoffTime "08:00"`, `toleranceMinutes 15`, `requireNoteWhenLate false`, dan `workingDays [0..6]`.

**1. Tepat waktu**
```bash
reset; patch "{\"defaultCutoffTime\":\"$(wib '+30 min')\",\"toleranceMinutes\":15}"
absen $BUDI "WFH"
```
Hasil: 201 dengan `"status":"ON_TIME","lateMinutes":0`.

**2. Dalam toleransi (lewat cutoff tapi belum lewat toleransi)**
```bash
reset; patch "{\"defaultCutoffTime\":\"$(wib '-10 min')\"}"
absen $BUDI
```
Hasil: `ON_TIME`, `lateMinutes: 0`. Batas persisnya: terlambat jika menit sekarang > cutoff + toleransi, sehingga selisih 15 menit masih tepat waktu dan 16 menit sudah `LATE`.

**3. Terlambat**
```bash
reset; patch "{\"defaultCutoffTime\":\"$(wib '-30 min')\"}"
absen $BUDI
```
Hasil: `"status":"LATE","lateMinutes":30` (dihitung dari cutoff dasar, bukan dari batas toleransi).

**4. Catatan wajib saat terlambat (jika HRD mengaktifkan)**
```bash
reset; patch '{"requireNoteWhenLate":true}'
absen $BUDI                       # tanpa catatan -> 400
absen $BUDI "Listrik padam"       # dengan catatan -> 201 LATE
```
Hasil: percobaan pertama 400 dengan pesan `Anda terlambat 30 menit (batas masuk ..., toleransi 15 menit). Catatan wajib diisi untuk absen terlambat.` Percobaan kedua 201. Pada percobaan 400 file foto di `uploads/` ikut dihapus (rollback gateway). Kembalikan dengan `patch '{"requireNoteWhenLate":false}'`.

**5. Ubah pengaturan lalu absen baru, absen lama tidak berubah**
```bash
# Buat karyawan kedua
curl -s -X POST $API/employees -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"nik":"2000000002","fullName":"Dewi Lestari","email":"dewi@company.test","password":"Karyawan123!","position":"QA","role":"EMPLOYEE"}' | jq .id
DEWI=$(login dewi@company.test 'Karyawan123!')

reset; patch "{\"defaultCutoffTime\":\"$(wib '-30 min')\"}"
absen $BUDI                                           # LATE, 30
patch "{\"defaultCutoffTime\":\"$(wib '+60 min')\"}"  # HRD melonggarkan
absen $DEWI                                           # ON_TIME, 0
curl -s "$API/attendances?limit=10" -H "Authorization: Bearer $ADMIN" | jq '.data[] | {n:.employee.fullName,status,lateMinutes}'
curl -s $API/attendances/me -H "Authorization: Bearer $BUDI" | jq '.data[0] | {status,lateMinutes}'
```
Hasil: Budi tetap `LATE` dengan `lateMinutes` 30, Dewi `ON_TIME`. Kedua endpoint list menampilkan `status` dan `lateMinutes`. `GET /attendances/today` juga membawa kedua field itu. Jika Dewi sudah ada dari tes sebelumnya, langkah pembuatan karyawan akan menghasilkan 409 dan bisa dilewati.

**6. EMPLOYEE mencoba PATCH, harus 403**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH $API/attendances/settings \
  -H "Authorization: Bearer $BUDI" -H 'Content-Type: application/json' -d '{"toleranceMinutes":30}'
```
Hasil: `403`.

**7. Validasi menolak input salah (semua harus 400, lalu GET membuktikan pengaturan tidak berubah)**
```bash
patch '{"earliestCheckIn":"6:00"}'
patch '{"earliestCheckIn":"24:00"}'
patch '{"defaultCutoffTime":"abc"}'
patch '{"toleranceMinutes":121}'
patch '{"toleranceMinutes":-1}'
patch '{"toleranceMinutes":1.5}'
patch '{"requireNoteWhenLate":"ya"}'
patch '{"workingDays":[7]}'
patch '{"workingDays":[1,1]}'
patch '{"workingDays":[]}'
patch '{"earliestCheckIn":"09:00","defaultCutoffTime":"08:00"}'   # lintas field
patch '{"earliestCheckIn":"23:00"}'                               # lintas field vs cutoff tersimpan
patch '{}'                                                        # tidak ada field
curl -s $API/attendances/settings -H "Authorization: Bearer $ADMIN" | jq
```
Setiap pesan berbahasa Indonesia. Dua kasus lintas field menghasilkan `Jam mulai absen (earliestCheckIn) harus lebih awal dari batas jam masuk (defaultCutoffTime)`. Karena `PATCH` bersifat parsial, kasus kedua dicek terhadap cutoff yang tersimpan.

**8. Hari non-kerja ditolak hanya jika HRD mengaturnya**
```bash
reset
# Default: semua hari kerja -> absen hari apa pun diterima (sudah terbukti di skenario 1-5).
TODAY=$(TZ=Asia/Jakarta date +%w)
patch "{\"workingDays\":$(jq -nc --argjson d $TODAY '[range(0;7)|select(.!=$d)]')}"
absen $BUDI      # 400: "Hari ini (...) bukan hari kerja. Absensi hanya dapat dilakukan pada hari: ..."
patch '{"workingDays":[0,1,2,3,4,5,6]}'
absen $BUDI      # 201
```

**9. Jam mulai absen (earliestCheckIn)**
```bash
reset; patch "{\"earliestCheckIn\":\"00:00\",\"defaultCutoffTime\":\"$(wib '+90 min')\"}"
patch "{\"earliestCheckIn\":\"$(wib '+30 min')\"}"
absen $BUDI      # 400: "Absensi belum dibuka. Absen dapat dilakukan mulai pukul HH:mm WIB."
patch '{"earliestCheckIn":"00:00"}'
absen $BUDI      # 201
```

**10. Idempotensi seed**: restart attendance-service dua kali. Baris `attendance_settings` tetap satu dan nilainya tidak kembali ke default. Status absensi lama tidak ikut berubah, termasuk rekaman skenario 3 dan 5 yang sengaja `LATE`.

Setelah selesai tes, kembalikan pengaturan ke default longgar agar tidak mengganggu tes frontend:
```bash
patch '{"earliestCheckIn":"00:00","defaultCutoffTime":"08:00","toleranceMinutes":15,"requireNoteWhenLate":false,"workingDays":[0,1,2,3,4,5,6]}'
```

---

## Daftar file

**Baru (4):**
```
libs/common/src/enums/attendance-status.enum.ts
libs/common/src/utils/attendance-settings.util.ts
apps/attendance-service/src/attendances/entities/attendance-settings.entity.ts
apps/attendance-service/src/attendances/attendance-settings.service.ts
```

**Ditimpa penuh (14):**
```
libs/common/src/index.ts
libs/common/src/constants/rpc.constants.ts
libs/common/src/interfaces/attendance.interface.ts
libs/common/src/utils/wib.util.ts
apps/attendance-service/src/attendance-service.module.ts
apps/attendance-service/src/attendances/attendances.module.ts
apps/attendance-service/src/attendances/attendances.controller.ts
apps/attendance-service/src/attendances/attendances.service.ts
apps/attendance-service/src/attendances/entities/attendance.entity.ts
apps/api-gateway/src/clients/attendance-service.client.ts
apps/api-gateway/src/attendances/attendance.mapper.ts
apps/api-gateway/src/attendances/dto/attendance.dto.ts
apps/api-gateway/src/attendances/attendances.service.ts
apps/api-gateway/src/attendances/attendances.controller.ts
```

---

## Keputusan default yang diambil

1. **Perbandingan per menit.** Detik diabaikan: 08:15:59 masih tepat waktu dan 08:16:00 sudah terlambat. Ini sama dengan jam HH:mm yang dilihat karyawan.
2. **`workingDays` minimal 1 hari.** Array kosong membuat semua orang ditolak, jadi ditolak validasi. Ini tambahan di luar daftar validasi awal.
3. **Urutan cek saat absen:** duplikat (409), hari kerja, `earliestCheckIn`, lalu catatan wajib. Karyawan yang sudah absen tetap mendapat 409, bukan 400 soal catatan.
4. **`GET /attendances/settings` tanpa `@Roles`.** Perilakunya sama dengan endpoint `photo` yang sudah ada (semua user login). Tidak diketahui apakah `@Roles` menerima banyak role sekaligus, jadi tidak ditebak.
5. **Foto tetap diunggah dulu sebelum aturan dicek.** Jika attendance-service menolak dengan 400, rollback gateway yang sudah ada menghapus file-nya. Pre-check di gateway sengaja tidak dibuat supaya tidak menduplikasi aturan.
6. **Backfill memakai SQL `HOUR()`/`MINUTE()` pada `check_in_at`.** Ini benar karena `buildTypeOrmOptions` memakai `timezone: '+07:00'`, sehingga kolom `datetime` berisi jam dinding WIB. Jika zona waktu itu suatu hari diubah, backfill (yang hanya jalan sekali) tidak terpengaruh.

---

## Langkah berikutnya

Fase 5.5-B (frontend): tab "Pengaturan absensi" dan badge status terlambat. Untuk Summary Cards, dibutuhkan juga `employees.countActive` di employee-service, jadi siapkan `employees.service.ts` dan `employees.controller.ts` dari employee-service yang terbaru (versi 5B atau yang sudah Anda ubah sendiri).
