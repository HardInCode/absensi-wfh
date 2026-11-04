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
