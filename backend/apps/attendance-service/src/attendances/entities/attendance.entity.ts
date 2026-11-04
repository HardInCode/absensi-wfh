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

