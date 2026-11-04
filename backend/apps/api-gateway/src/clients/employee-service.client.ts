import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthUser,
  CreateEmployeeDto,
  EMPLOYEE_SERVICE,
  EmployeePattern,
  EmployeeView,
  LoginDto,
  LoginResult,
  PaginatedResult,
  QueryEmployeesDto,
  sendRpc,
  UpdateEmployeeDto,
} from '@app/common';

@Injectable()
export class EmployeeServiceClient {
  private readonly timeoutMs: number;

  constructor(
    @Inject(EMPLOYEE_SERVICE) private readonly client: ClientProxy,
    config: ConfigService,
  ) {
    this.timeoutMs = config.getOrThrow<number>('RPC_TIMEOUT_MS');
  }

  private call<R, D>(pattern: string, data: D): Promise<R> {
    return sendRpc<R, D>(this.client, pattern, data, this.timeoutMs);
  }

  login(dto: LoginDto) {
    return this.call<LoginResult, LoginDto>(EmployeePattern.AUTH_LOGIN, dto);
  }

  validateUser(id: string) {
    return this.call<AuthUser, { id: string }>(EmployeePattern.AUTH_VALIDATE, { id });
  }

  create(dto: CreateEmployeeDto) {
    return this.call<EmployeeView, CreateEmployeeDto>(
      EmployeePattern.EMPLOYEES_CREATE,
      dto,
    );
  }

  findAll(query: QueryEmployeesDto) {
    return this.call<PaginatedResult<EmployeeView>, QueryEmployeesDto>(
      EmployeePattern.EMPLOYEES_FIND_ALL,
      query,
    );
  }

  findOne(id: string) {
    return this.call<EmployeeView, { id: string }>(
      EmployeePattern.EMPLOYEES_FIND_ONE,
      { id },
    );
  }

  update(id: string, data: UpdateEmployeeDto) {
    return this.call<EmployeeView, { id: string; data: UpdateEmployeeDto }>(
      EmployeePattern.EMPLOYEES_UPDATE,
      { id, data },
    );
  }

  remove(id: string) {
    return this.call<EmployeeView, { id: string }>(
      EmployeePattern.EMPLOYEES_REMOVE,
      { id },
    );
  }
}

