import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLowerCase } from '../../common/transformers/string.transformers';

export class LoginDto {
  @ApiProperty({ example: 'admin@company.test' })
  @Transform(trimLowerCase)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}

