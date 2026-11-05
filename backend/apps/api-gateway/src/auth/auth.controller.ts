import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AuthUser,
  LoginDto,
  LoginResponseDto,
  MeResponseDto,
} from '@app/common';
import { EmployeeServiceClient } from '../clients/employee-service.client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly employees: EmployeeServiceClient) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Email atau password salah' })
  @ApiTooManyRequestsResponse({ description: 'Terlalu banyak percobaan login. Silakan tunggu 1 menit.' })
  login(@Body() dto: LoginDto) {
    return this.employees.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}

