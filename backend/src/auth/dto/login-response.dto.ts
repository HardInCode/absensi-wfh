import { ApiProperty } from '@nestjs/swagger';
import { Employee } from '../../employees/entities/employee.entity';

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 28800, description: 'Masa berlaku token dalam detik' })
  expiresIn: number;

  @ApiProperty({ type: () => Employee })
  user: Employee;
}

