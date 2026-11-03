import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums/role.enum';
import { trim } from '../../common/transformers/string.transformers';

export class QueryEmployeeDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cari berdasarkan nama, NIK, atau email' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Filter status aktif (true/false). Kosong = semua.' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  is_active?: boolean;
}

