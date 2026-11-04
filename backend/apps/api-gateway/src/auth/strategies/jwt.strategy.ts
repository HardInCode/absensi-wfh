import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '@app/common';
import { EmployeeServiceClient } from '../../clients/employee-service.client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly employees: EmployeeServiceClient,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  /** Tanda tangan sudah valid. Cek ke employee-service bahwa akun masih ada dan aktif. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    return this.employees.validateUser(payload.sub);
  }
}

