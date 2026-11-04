import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('attendances')
@Unique('uq_attendance_employee_date', ['employeeId', 'attendanceDate'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employeeId: string;

  @ManyToOne(() => Employee, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'check_in_at', type: 'datetime' })
  checkInAt: Date;

  // Tipe DATE di MySQL -> dibaca TypeORM sebagai string 'YYYY-MM-DD'
  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  // Hanya nama file (UUID.ext) relatif terhadap folder uploads/. Tidak dikirim ke client.
  @Exclude()
  @Column({ name: 'photo_path', type: 'varchar', length: 255 })
  photoPath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

