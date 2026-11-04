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
