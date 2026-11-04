import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

export class AttendanceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ example: '2026-11-04' }) attendanceDate: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() checkInAt: string;
  @ApiProperty({ example: '/api/attendances/<id>/photo' }) photoUrl: string;
  @ApiProperty({ nullable: true }) notes: string | null;
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

