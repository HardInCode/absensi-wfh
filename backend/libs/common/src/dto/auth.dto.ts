import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Role } from '../enums/role.enum';

export class LoginDto {
  @ApiProperty({ example: 'admin@company.test' })
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class LoginUserDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() position: string;
  @ApiProperty({ enum: Role }) role: Role;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: 28800 }) expiresIn: number;
  @ApiProperty({ type: LoginUserDto }) user: LoginUserDto;
}

export class MeResponseDto extends LoginUserDto {
  @ApiProperty() isActive: boolean;
}

