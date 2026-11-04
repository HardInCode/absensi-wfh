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
