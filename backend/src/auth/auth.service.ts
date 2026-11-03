import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../common/constants/app.constants';
import { EmployeesService } from '../employees/employees.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  /** Hash palsu agar waktu respons sama untuk email yang tidak terdaftar (anti user enumeration). */
  private readonly dummyHash = bcrypt.hashSync('dummy-password', BCRYPT_SALT_ROUNDS);

  constructor(
    private readonly employeesService: EmployeesService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const employee = await this.employeesService.findByEmailWithPassword(dto.email);

    const passwordOk = await bcrypt.compare(
      dto.password,
      employee?.passwordHash ?? this.dummyHash,
    );

    if (!employee || !passwordOk) {
      throw new UnauthorizedException('Email atau password salah');
    }

    // Dicek setelah password benar, agar status akun tidak bocor ke pihak tak berwenang.
    if (!employee.isActive) {
      throw new ForbiddenException('Akun Anda nonaktif. Silakan hubungi HRD.');
    }

    const payload: JwtPayload = { sub: employee.id, role: employee.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: Number(this.config.get('JWT_EXPIRES_IN_SECONDS') ?? 28800),
      user: employee, // passwordHash dibuang oleh @Exclude() + ClassSerializerInterceptor
    };
  }
}

