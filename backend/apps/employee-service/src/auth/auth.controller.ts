import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, EmployeePattern, LoginDto } from '@app/common';
import { AuthService } from './auth.service';

@Controller()
@UseFilters(AllRpcExceptionsFilter)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(EmployeePattern.AUTH_LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @MessagePattern(EmployeePattern.AUTH_VALIDATE)
  validate(@Payload() payload: { id: string }) {
    return this.auth.validate(payload.id);
  }
}

