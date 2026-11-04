import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Email atau password salah' })
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

