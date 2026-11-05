import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Role } from '../enums/role.enum';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const toBoolean = ({ value }: TransformFnParams) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateEmployeeDto {
  @ApiProperty({ example: '2000000002' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nik: string;

  @ApiProperty({ example: 'Ani Wijaya' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: 'ani@company.test' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'Karyawan123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'QA Engineer' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position: string;

  @ApiProperty({ enum: Role, example: Role.EMPLOYEE })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** NIK tidak bisa diubah. Field nik yang dikirim akan dibuang oleh whitelist. */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['nik'] as const),
) {}

export class QueryEmployeesDto {
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

  @ApiPropertyOptional({ description: 'Cari di nama, NIK, email, atau jabatan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter jabatan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class EmployeeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() position: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class PaginationMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class EmployeeListResponseDto {
  @ApiProperty({ type: [EmployeeResponseDto] }) data: EmployeeResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}

