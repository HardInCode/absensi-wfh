import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceEmployeeSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() position: string;
}

export class AttendanceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() employeeId: string;
  @ApiProperty({ description: 'ISO 8601 (UTC). Tampilkan dalam WIB di frontend.' })
  checkInAt: string;
  @ApiProperty({ example: '2026-11-03', description: 'Tanggal absen menurut WIB' })
  attendanceDate: string;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty({ example: '/api/attendances/<id>/photo' }) photoUrl: string;
  @ApiPropertyOptional({ type: AttendanceEmployeeSummaryDto })
  employee?: AttendanceEmployeeSummaryDto;
}

class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedAttendanceResponseDto {
  @ApiProperty({ type: [AttendanceResponseDto] }) data: AttendanceResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}

