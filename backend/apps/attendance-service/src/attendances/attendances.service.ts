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
