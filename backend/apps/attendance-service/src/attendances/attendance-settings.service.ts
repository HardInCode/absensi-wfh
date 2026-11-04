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
