import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QueryAttendanceDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01', description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_from harus berformat YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'date_from bukan tanggal yang valid' })
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Format YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_to harus berformat YYYY-MM-DD' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'date_to bukan tanggal yang valid' })
  date_to?: string;

  @ApiPropertyOptional({ example: 'budi', description: 'Pencarian sebagian nama karyawan' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  employee_name?: string;
}

