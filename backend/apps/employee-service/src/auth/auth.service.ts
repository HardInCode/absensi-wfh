import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthUser, JwtPayload, LoginDto, LoginResult } from '@app/common';
import { EmployeesService } from '../employees/employees.service';

@Injectable()
export class AuthService {
  /** Hash tiruan agar waktu respons sama baik email ada maupun tidak. */
  private readonly dummyHash: string;

  constructor(
    private readonly employees: EmployeesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.dummyHash = bcrypt.hashSync(
      'dummy-password',
      this.config.getOrThrow<number>('BCRYPT_ROUNDS'),
    );
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const employee = await this.employees.findByEmailWithPassword(dto.email);
    const passwordOk = await bcrypt.compare(
      dto.password,
      employee?.passwordHash ?? this.dummyHash,
    );
    if (!employee || !passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!employee.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    const payload: JwtPayload = { sub: employee.id, role: employee.role };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      expiresIn: this.config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS'),
      user: {
        id: employee.id,
        nik: employee.nik,
        fullName: employee.fullName,
        email: employee.email,
        position: employee.position,
        role: employee.role,
      },
    };
  }

  /** Dipanggil gateway di setiap request ber-token: akun nonaktif/terhapus langsung ditolak. */
  async validate(id: string): Promise<AuthUser> {
    const e = await this.employees.findEntityOrNull(id);
    if (!e || !e.isActive) throw new UnauthorizedException('Unauthorized');
    return {
      id: e.id,
      nik: e.nik,
      fullName: e.fullName,
      email: e.email,
      position: e.position,
      role: e.role,
      isActive: e.isActive,
    };
  }
}

