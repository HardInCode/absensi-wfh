import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Employee } from '../../employees/entities/employee.entity';
import { EmployeesService } from '../../employees/employees.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly employeesService: EmployeesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  /**
   * Dipanggil setiap request. Data user selalu dibaca ulang dari DB,
   * sehingga akun yang dinonaktifkan langsung kehilangan akses
   * walau tokennya belum kedaluwarsa. Hasilnya menjadi request.user.
   */
  async validate(payload: JwtPayload): Promise<Employee> {
    const employee = await this.employeesService.findActiveById(payload.sub);
    if (!employee) {
      throw new UnauthorizedException('Token tidak valid atau akun nonaktif');
    }
    return employee;
  }
}

