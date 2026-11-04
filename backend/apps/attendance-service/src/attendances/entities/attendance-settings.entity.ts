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

