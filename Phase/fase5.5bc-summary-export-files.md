# Fase 5.5-B dan C (Backend): Summary Harian, Filter Status, Export CSV (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Fase 5A, 5B, dan 5.5-A (`fase5-microservices-files.md`, `fase5b-attendance-files.md`, `fase5-5a-attendance-settings-files.md`) sudah terpasang dan lulus tes. Fase ini menambah: (1) endpoint ringkasan harian `GET /api/attendances/summary`, (2) filter `status` pada daftar absensi HRD, dan (3) export CSV `GET /api/attendances/export`. Buat setiap file baru pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya. File yang ditandai "(diubah)" ditimpa penuh. Buat folder yang belum ada. Frontend tidak diubah di fase ini.

Catatan penting:
- Semua path relatif terhadap `absensi-wfh/backend/` kecuali disebut lain.
- Tidak ada env baru, tabel baru, perubahan skema, atau dependensi npm baru. Modul NestJS tidak berubah karena tidak ada provider baru. Satu-satunya perubahan konfigurasi adalah `exposedHeaders` di CORS pada `main.ts` gateway.
- Karena ada RPC pattern baru di dua service, **ketiga proses wajib di-restart**, dengan urutan: employee-service, attendance-service, lalu api-gateway.
- Kode ditulis tanpa dijalankan. Setelah semua file dibuat, jalankan `npm run typecheck`, perbaiki error compile bila ada tanpa mengubah perilaku yang dijelaskan di sini, lalu uji dengan bagian "Skenario uji".
- Frontend Fase 3 dan 4 tetap kompatibel: semua perubahan hanya menambah endpoint dan parameter opsional.

---

## 1. `libs/common`

### `absensi-wfh/backend/libs/common/src/constants/rpc.constants.ts` (diubah)
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
  EMPLOYEES_FIND_ACTIVE_STAFF: 'employees.findActiveStaff',
} as const;

export const AttendancePattern = {
  CREATE: 'attendances.create',
  FIND_TODAY: 'attendances.findToday',
  FIND_ALL: 'attendances.findAll',
  FIND_ONE: 'attendances.findOne',
  GET_SETTINGS: 'attendances.getSettings',
  UPDATE_SETTINGS: 'attendances.updateSettings',
  GET_DAILY_STATS: 'attendances.getDailyStats',
} as const;

export const TIMEZONE = 'Asia/Jakarta';
```

### `absensi-wfh/backend/libs/common/src/interfaces/attendance.interface.ts` (diubah)
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

---

## 2. `employee-service`

### `absensi-wfh/backend/apps/employee-service/src/employees/employees.service.ts` (diubah)
Perubahan dari 5.5-A: import `Role` dan method baru `findActiveStaff`.
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
  Role,
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

  // ---- dipakai summary harian lewat gateway (Fase 5.5) ----

  /**
   * Populasi yang wajib absen: aktif DAN role EMPLOYEE (ADMIN_HRD tidak dihitung).
   * Satu query, terurut menurut nama.
   */
  async findActiveStaff(): Promise<EmployeeBrief[]> {
    const rows = await this.repo.find({
      where: { isActive: true, role: Role.EMPLOYEE },
      select: { id: true, nik: true, fullName: true },
      order: { fullName: 'ASC', id: 'ASC' },
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

### `absensi-wfh/backend/apps/employee-service/src/employees/employees.controller.ts` (diubah)
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

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_ACTIVE_STAFF)
  findActiveStaff() {
    return this.employees.findActiveStaff();
  }
}
```

---

## 3. `attendance-service`

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.service.ts` (diubah)
Perubahan dari 5.5-A: filter `status` di `findAll` dan method baru `getDailyStats`.
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

### `absensi-wfh/backend/apps/attendance-service/src/attendances/attendances.controller.ts` (diubah)
```ts
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AllRpcExceptionsFilter,
  AttendancePattern,
  CreateAttendancePayload,
  DailyStatsPayload,
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

  @MessagePattern(AttendancePattern.GET_DAILY_STATS)
  getDailyStats(@Payload() payload: DailyStatsPayload) {
    return this.attendances.getDailyStats(payload);
  }
}
```

---

## 4. `api-gateway`

### `absensi-wfh/backend/apps/api-gateway/src/clients/employee-service.client.ts` (diubah)
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

  /** Karyawan aktif ber-role EMPLOYEE (tanpa ADMIN_HRD), terurut menurut nama. */
  findActiveStaff() {
    return this.call<EmployeeBrief[], Record<string, never>>(
      EmployeePattern.EMPLOYEES_FIND_ACTIVE_STAFF,
      {},
    );
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/clients/attendance-service.client.ts` (diubah)
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
  DailyStatsPayload,
  DailyStatsResult,
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

  getDailyStats(payload: DailyStatsPayload) {
    return this.call<DailyStatsResult, DailyStatsPayload>(
      AttendancePattern.GET_DAILY_STATS,
      payload,
    );
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.export.constants.ts` (baru)
```ts
/** Batas baris export CSV. Jika data lebih banyak, respons dipotong dan diberi header X-Export-Truncated. */
export const EXPORT_MAX_ROWS = 5000;
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/utils/csv.util.ts` (baru)
```ts
/** Sel teks yang diawali karakter ini dibaca Excel/Sheets sebagai rumus (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Netralkan rumus dengan awalan apostrof. Hanya untuk sel teks, bukan angka. */
export function sanitizeCsvText(value: string | null | undefined): string {
  const s = value ?? '';
  return FORMULA_START.test(s) ? `'${s}` : s;
}

type CsvValue = string | number | null | undefined;

/** Sanitasi (teks saja), lalu bungkus tanda kutip jika ada koma, kutip, atau baris baru; " digandakan. */
export function csvCell(value: CsvValue): string {
  const s = typeof value === 'number' ? String(value) : sanitizeCsvText(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Baris dipisah CRLF (RFC 4180), diakhiri CRLF. BOM ditambahkan oleh pemanggil. */
export function buildCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/dto/attendance.dto.ts` (diubah)
Perubahan dari 5.5-A: import `OmitType` dan `IsEnum`, field `status` di `QueryAttendancesDto`, kelas `ExportAttendancesQueryDto`, `QuerySummaryDto`, dan `AttendanceSummaryResponseDto`.
```ts
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
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

const trimUpper = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

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

  @ApiPropertyOptional({ enum: AttendanceStatus, enumName: 'AttendanceStatus' })
  @IsOptional()
  @Transform(trimUpper)
  @IsEnum(AttendanceStatus, { message: 'status harus ON_TIME atau LATE' })
  status?: AttendanceStatus;
}

/** Filter export = filter daftar HRD tanpa paginasi (selalu halaman 1, maks 5000 baris). */
export class ExportAttendancesQueryDto extends OmitType(QueryAttendancesDto, [
  'page',
  'limit',
] as const) {}

export class QuerySummaryDto {
  @ApiPropertyOptional({
    example: '2026-11-04',
    description: 'YYYY-MM-DD (WIB). Default: hari ini WIB.',
  })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date harus berformat YYYY-MM-DD' })
  date?: string;
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

export class AttendanceSummaryResponseDto {
  @ApiProperty({ example: '2026-11-04' }) date: string;
  @ApiProperty({ description: 'Karyawan aktif ber-role EMPLOYEE' }) totalEmployees: number;
  @ApiProperty() presentCount: number;
  @ApiProperty() onTimeCount: number;
  @ApiProperty() lateCount: number;
  @ApiProperty() absentCount: number;
  @ApiProperty({ type: [AttendanceEmployeeDto] }) absentEmployees: AttendanceEmployeeDto[];
}
```

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.service.ts` (diubah)
Perubahan dari 5.5-A: `resolveFilter` dan `briefsById` dipakai bersama oleh `list` dan `exportCsv`, ditambah `summary` dan `exportCsv`.
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

### `absensi-wfh/backend/apps/api-gateway/src/attendances/attendances.controller.ts` (diubah)
Rute statis `settings`, `summary`, dan `export` harus tetap dideklarasikan sebelum `@Get()` dan `:id/photo`. Jangan diubah urutannya.
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
  Res,
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
import type { Response } from 'express';
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
  AttendanceSummaryResponseDto,
  CreateAttendanceDto,
  ExportAttendancesQueryDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
  QuerySummaryDto,
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

  @Get('summary')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSummaryResponseDto })
  summary(@Query() query: QuerySummaryDto) {
    return this.attendances.summary(query);
  }

  @Get('export')
  @Roles(Role.ADMIN_HRD)
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description:
      'File CSV (UTF-8 dengan BOM), maks 5000 baris. Header X-Export-Truncated: true jika data terpotong.',
  })
  @Header('Cache-Control', 'private, no-store')
  async exportCsv(
    @Query() query: ExportAttendancesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { content, filename, truncated } = await this.attendances.exportCsv(query);
    res.setHeader('X-Export-Truncated', String(truncated));
    const body = Buffer.from(content, 'utf8');
    return new StreamableFile(body, {
      type: 'text/csv; charset=utf-8',
      length: body.length,
      disposition: `attachment; filename="${filename}"`,
    });
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

### `absensi-wfh/backend/apps/api-gateway/src/main.ts` (diubah: hanya `exposedHeaders`)
```ts
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // Agar frontend (Axios) bisa membaca nama file dan penanda export terpotong.
    exposedHeaders: ['Content-Disposition', 'X-Export-Truncated'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Absensi WFH API')
      .setDescription('API Gateway: satu-satunya pintu masuk publik')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.getOrThrow<number>('GATEWAY_PORT');
  await app.listen(port);
  Logger.log(`api-gateway listening on :${port} (Swagger: /api/docs)`, 'Bootstrap');
}

bootstrap();
```

---

## 5. Cara menjalankan

Tidak ada env atau migrasi baru. Restart tiga proses dengan urutan: **employee-service**, **attendance-service**, lalu **api-gateway**.

```bash
cd absensi-wfh/backend
npm run typecheck        # harus 0 error
docker compose up -d     # MySQL
# lalu restart employee-service, attendance-service, api-gateway (mis. npm run start:dev)
```

---

## 6. Skenario uji

Persiapan (ulang helper dari Fase 5.5-A karena sesi shell bisa baru). Butuh `curl`, `jq`, GNU `date`, dan `foto.jpg` yang valid:
```bash
API=http://localhost:3000/api
login() { curl -s $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .accessToken; }
ADMIN=$(login admin@company.test 'Admin123!')
BUDI=$(login budi@company.test 'Karyawan123!')
TODAY=$(TZ=Asia/Jakarta date +%F)
wib()   { TZ=Asia/Jakarta date -d "$1" +%H:%M; }
patch() { curl -s -X PATCH $API/attendances/settings -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d "$1"; echo; }
absen() { curl -s -X POST $API/attendances -H "Authorization: Bearer $1" -F photo=@foto.jpg ${2:+-F "notes=$2"}; echo; }
resetday() { docker exec -i absensi-mysql mysql -uabsensi_user -pabsensi_pass absensi_wfh -e "DELETE FROM attendances WHERE attendance_date='$TODAY'"; }
sum() { curl -s "$API/attendances/summary${1:+?date=$1}" -H "Authorization: Bearer $ADMIN" | jq; }
```

**1. Data campuran (hadir tepat waktu, terlambat, belum absen)**
```bash
# Karyawan tambahan (abaikan 409 jika sudah ada dari fase sebelumnya)
for u in "2000000002|Dewi Lestari|dewi@company.test" "2000000003|Andi Pratama|andi@company.test"; do
  IFS='|' read nik nama email <<< "$u"
  curl -s -X POST $API/employees -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
    -d "{\"nik\":\"$nik\",\"fullName\":\"$nama\",\"email\":\"$email\",\"password\":\"Karyawan123!\",\"position\":\"Staff\",\"role\":\"EMPLOYEE\"}" | jq -c '{id,fullName}'
done
DEWI=$(login dewi@company.test 'Karyawan123!')

resetday
patch "{\"defaultCutoffTime\":\"$(wib '-30 min')\"}"; absen $BUDI "Macet"      # LATE 30
patch "{\"defaultCutoffTime\":\"$(wib '+60 min')\"}"; absen $DEWI              # ON_TIME
sum
```
Hasil: `totalEmployees: 3` (Budi, Dewi, Andi; sesuaikan jika DB Anda punya karyawan aktif lain), `presentCount: 2`, `onTimeCount: 1`, `lateCount: 1`, `absentCount: 1`, dan `absentEmployees` berisi Andi Pratama dengan `id`, `fullName`, `nik`. Berlaku `total = hadir + belum absen`.

**2. Admin tidak ikut dihitung**
```bash
sum | jq '[.absentEmployees[].nik] | index("1000000001")'      # harus null
curl -s "$API/employees?role=EMPLOYEE&isActive=true&limit=100" -H "Authorization: Bearer $ADMIN" | jq '.meta.total'   # harus sama dengan totalEmployees
# Karyawan dinonaktifkan juga keluar dari total:
ANDI_ID=$(sum | jq -r '.absentEmployees[] | select(.nik=="2000000003") | .id')
curl -s -X DELETE $API/employees/$ANDI_ID -H "Authorization: Bearer $ADMIN" >/dev/null
sum | jq '{totalEmployees,absentCount}'                         # total turun 1, absent 0
curl -s -X PATCH $API/employees/$ANDI_ID -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"isActive":true}' >/dev/null
```

**3. Filter tanggal**
```bash
BUDI_ID=$(curl -s $API/auth/me -H "Authorization: Bearer $BUDI" | jq -r .id)
docker exec -i absensi-mysql mysql -uabsensi_user -pabsensi_pass absensi_wfh -e "
INSERT INTO attendances (id, employee_id, check_in_at, attendance_date, photo_path, notes, status, late_minutes, created_at)
VALUES (UUID(), '$BUDI_ID', '2026-10-15 08:40:00', '2026-10-15', 'dummy.jpg', NULL, 'LATE', 40, NOW());"
sum 2026-10-15 | jq '{date,totalEmployees,presentCount,lateCount,absentCount}'   # hadir 1, terlambat 1
sum 2026-10-14 | jq '{presentCount,absentCount}'                                 # hadir 0, semua belum absen
sum 2026-13-45                                                                    # 400 tanggal tidak valid
sum abc                                                                           # 400 format harus YYYY-MM-DD
```
Filter tanggal dan status pada daftar:
```bash
curl -s "$API/attendances?date_from=2026-10-15&date_to=2026-10-15" -H "Authorization: Bearer $ADMIN" | jq '.meta.total'   # 1
curl -s "$API/attendances?status=LATE&limit=50"   -H "Authorization: Bearer $ADMIN" | jq '[.data[].status] | unique'       # ["LATE"]
curl -s "$API/attendances?status=ON_TIME&limit=50" -H "Authorization: Bearer $ADMIN" | jq '[.data[].status] | unique'      # ["ON_TIME"]
curl -s -o /dev/null -w "%{http_code}\n" "$API/attendances?status=FOO" -H "Authorization: Bearer $ADMIN"                   # 400
```
Setelah tes, hapus baris dummy: `DELETE FROM attendances WHERE photo_path='dummy.jpg'` (file `dummy.jpg` tidak ada di `uploads/`, jadi foto baris ini tidak bisa dibuka).

**4. Export dan pembukaan di Excel**
```bash
curl -s -D - -o rekap.csv "$API/attendances/export?date_from=$TODAY&date_to=$TODAY" -H "Authorization: Bearer $ADMIN" | grep -iE 'HTTP/|content-type|content-disposition|x-export'
head -c 3 rekap.csv | xxd            # harus: efbb bf (BOM)
cat -A rekap.csv | head -5           # header benar, baris diakhiri ^M$ (CRLF)
```
Hasil: `200`, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="rekap-absensi-wfh-<hari ini>.csv"`, `X-Export-Truncated: false`. Baris pertama: `NIK,Nama Karyawan,Tanggal,Jam (WIB),Status,Keterlambatan (Menit),Catatan`. Kolom Status berisi `Tepat Waktu` atau `Terlambat`.

Buka `rekap.csv` dengan double-click di Excel. Cek bahwa huruf Indonesia tampil benar dan 7 kolom terpisah. Jika Excel memakai regional Indonesia, pemisah daftar bawaannya sering `;`, sehingga file berkoma bisa tampil dalam satu kolom. Itu perilaku Excel, bukan bug berkas. Cara membukanya: **Data → From Text/CSV → Delimiter: Comma**.

Filter export:
```bash
curl -s "$API/attendances/export?status=LATE&employee_name=budi" -H "Authorization: Bearer $ADMIN" | tail -n +2
curl -s -o /dev/null -w "%{http_code}\n" "$API/attendances/export?status=FOO" -H "Authorization: Bearer $ADMIN"          # 400
curl -s "$API/attendances/export?employee_name=tidak-ada-orang" -H "Authorization: Bearer $ADMIN"                        # hanya header
```

**5. Sel berawalan `=` ditetralkan, koma dan tanda kutip di-escape**
```bash
resetday
patch "{\"defaultCutoffTime\":\"$(wib '+60 min')\"}"
absen $BUDI '=1+1,"x"'
curl -s "$API/attendances/export?date_from=$TODAY&date_to=$TODAY" -H "Authorization: Bearer $ADMIN" | tail -n +2 | cat -A
```
Hasil: kolom Catatan tepat `"'=1+1,""x"""`. Awalan `'` menetralkan rumus, koma dan kutip ikut di-escape, dan sel tetap satu kolom. Di Excel sel tampil sebagai `=1+1,"x"` tanpa terhitung sebagai rumus. Ulangi dengan catatan `+cmd`, `-5`, dan `@SUM(A1)` (pakai `resetday` di antaranya); masing-masing harus mendapat awalan `'`. Catatan biasa (`Macet, ban bocor`) hanya dibungkus kutip karena ada koma, tanpa awalan.

**6. EMPLOYEE mencoba summary dan export, harus 403**
```bash
curl -s -o /dev/null -w "summary: %{http_code}\n" $API/attendances/summary -H "Authorization: Bearer $BUDI"
curl -s -o /dev/null -w "export:  %{http_code}\n" $API/attendances/export  -H "Authorization: Bearer $BUDI"
curl -s -o /dev/null -w "tanpa token: %{http_code}\n" $API/attendances/summary
```
Hasil: `403`, `403`, `401`.

**7. Batas 5000 baris (opsional)**
Ubah `EXPORT_MAX_ROWS` menjadi `1` sementara, restart gateway, lalu panggil export saat ada 2 baris atau lebih. Respons harus berisi header plus 1 baris dengan `X-Export-Truncated: true`. Kembalikan ke `5000` setelahnya.

**8. Regresi**: `GET /api/attendances`, `/me`, `/today`, `/settings`, dan upload absen tetap berjalan seperti sebelumnya (kontrak lama hanya ditambah field dan parameter opsional). Halaman frontend `/absensi` dan `/hrd/monitoring` tetap berfungsi.

---

## 7. Daftar file

**Baru (2):**
```
apps/api-gateway/src/attendances/attendances.export.constants.ts
apps/api-gateway/src/attendances/utils/csv.util.ts
```

**Diubah / ditimpa penuh (12):**
```
libs/common/src/constants/rpc.constants.ts
libs/common/src/interfaces/attendance.interface.ts
apps/employee-service/src/employees/employees.service.ts
apps/employee-service/src/employees/employees.controller.ts
apps/attendance-service/src/attendances/attendances.service.ts
apps/attendance-service/src/attendances/attendances.controller.ts
apps/api-gateway/src/clients/employee-service.client.ts
apps/api-gateway/src/clients/attendance-service.client.ts
apps/api-gateway/src/attendances/dto/attendance.dto.ts
apps/api-gateway/src/attendances/attendances.service.ts
apps/api-gateway/src/attendances/attendances.controller.ts
apps/api-gateway/src/main.ts
```

---

## 8. Keputusan default yang diambil

1. **Summary memakai daftar karyawan saat ini, bukan historis.** Untuk tanggal lampau, "belum absen" dihitung terhadap karyawan yang aktif sekarang. Karyawan yang baru dinonaktifkan tidak muncul di summary hari lampau. Riwayat penuh akan butuh tabel histori status, yang di luar lingkup.
2. **Statistik harian lewat satu query yang mengambil `employee_id` dan `status`, bukan `COUNT` agregat.** `presentEmployeeIds` memang harus dikembalikan, dan UNIK `(employee_id, attendance_date)` menjamin satu baris per karyawan, jadi hasilnya identik tanpa query kedua.
3. **Nilai kolom Status di CSV memakai label Indonesia** (`Tepat Waktu` / `Terlambat`), bukan `ON_TIME`/`LATE`, supaya laporan HRD langsung terbaca. Filter query tetap `ON_TIME`/`LATE`.
4. **Kolom Tanggal memakai `attendanceDate` (WIB), kolom Jam dari `checkInAt` diformat `HH:mm:ss` WIB.** Excel kadang menampilkan `2026-11-04` sebagai tanggal lokal. Isi sel tetap benar.
5. **`status` di query dinormalkan ke huruf besar** (`late` diterima sebagai `LATE`). Nilai selain `ON_TIME`/`LATE` menghasilkan 400.
6. **Export memakai `OmitType` dari `@nestjs/swagger`** atas `QueryAttendancesDto`, jadi filternya otomatis identik dengan daftar. `page` dan `limit` yang dikirim ke export diabaikan.
7. **NIK yang diawali nol** (mis. `0012345`) bisa tampil tanpa nol di Excel karena Excel menganggapnya angka. Sengaja tidak diakali dengan `="..."`, karena itu bertabrakan dengan sanitasi rumus. Jika HRD memerlukannya, opsi yang aman adalah memberi awalan `'` khusus kolom NIK.
8. **Daftar "Belum Absen" dikembalikan penuh di `absentEmployees`** tanpa paginasi, karena jumlahnya dibatasi jumlah karyawan aktif. Tidak ada filter "Belum Absen" di tabel.

---

## 9. Langkah berikutnya

Setelah backend ini lulus uji, lanjut ke sisi UI Fase 5.5-B/C: halaman Monitoring HRD (summary cards, filter status, tombol export), komponen tabel, instance Axios `api` (untuk membaca header `Content-Disposition` dan `X-Export-Truncated` pada unduhan), serta route/navbar untuk tab **Pengaturan absensi**.
