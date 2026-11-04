import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { trim, trimLowerCase } from '../../common/transformers/string.transformers';

export class CreateEmployeeDto {
  @ApiProperty({ example: '3201012345670001' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'nik hanya boleh berisi huruf, angka, titik, strip, atau underscore',
  })
  nik: string;

  @ApiProperty({ example: 'Siti Aminah' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: 'siti@company.test' })
  @Transform(trimLowerCase)
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'Rahasia123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // batas bcrypt
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password harus mengandung minimal satu huruf dan satu angka',
  })
  password: string;

  @ApiProperty({ example: 'UI Designer' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position: string;

  @ApiPropertyOptional({ enum: Role, default: Role.EMPLOYEE })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

