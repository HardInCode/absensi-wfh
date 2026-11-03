import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ description: 'false = nonaktifkan, true = aktifkan kembali' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

