# File untuk perbaikan keamanan

## backend\apps\api-gateway\src\api-gateway.module.ts
```
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateGatewayEnv } from '@app/common';
import { AttendancesModule } from './attendances/attendances.module';
import { AuthModule } from './auth/auth.module';
import { ServiceClientsModule } from './clients/service-clients.module';
import { EmployeesModule } from './employees/employees.module';
import { TimeModule } from './time/time.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateGatewayEnv,
    }),
    ServiceClientsModule,
    AuthModule,
    EmployeesModule,
    AttendancesModule,
    TimeModule,
  ],
})
export class ApiGatewayModule {}

```

## backend\apps\api-gateway\src\main.ts
```
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // Agar frontend (Axios) bisa membaca nama file dan penanda export terpotong.
    exposedHeaders: ['Content-Disposition', 'X-Export-Truncated'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Absensi WFH API')
      .setDescription('API Gateway: satu-satunya pintu masuk publik')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.getOrThrow<number>('GATEWAY_PORT');
  await app.listen(port);
  Logger.log(`api-gateway listening on :${port} (Swagger: /api/docs)`, 'Bootstrap');
}

bootstrap();

```

## backend\apps\api-gateway\src\attendances\attendances.controller.ts
```
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, Role } from '@app/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MAX_PHOTO_BYTES } from './attendances.constants';
import { AttendancesService } from './attendances.service';
import {
  AttendanceAdminListResponseDto,
  AttendanceListResponseDto,
  AttendanceResponseDto,
  AttendanceSettingsResponseDto,
  AttendanceSummaryResponseDto,
  CreateAttendanceDto,
  ExportAttendancesQueryDto,
  QueryAttendancesDto,
  QueryMyAttendancesDto,
  QuerySummaryDto,
  UpdateAttendanceSettingsDto,
} from './dto/attendance.dto';

@ApiTags('attendances')
@ApiBearerAuth()
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendances: AttendancesService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'jpg/png/webp, maks 3 MB' },
        notes: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5 },
    }),
  )
  submit(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendances.submit(user, photo, dto);
  }

  @Get('today')
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceResponseDto, description: 'null jika belum absen' })
  today(@CurrentUser() user: AuthUser) {
    return this.attendances.today(user);
  }

  @Get(['my', 'me'])
  @Roles(Role.EMPLOYEE)
  @ApiOkResponse({ type: AttendanceListResponseDto })
  mine(@CurrentUser() user: AuthUser, @Query() query: QueryMyAttendancesDto) {
    return this.attendances.mine(user, query);
  }

  /** Tanpa @Roles: semua user login (EMPLOYEE dan ADMIN_HRD), sama seperti endpoint photo. */
  @Get('settings')
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  getSettings() {
    return this.attendances.getSettings();
  }

  @Patch('settings')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSettingsResponseDto })
  updateSettings(@Body() dto: UpdateAttendanceSettingsDto) {
    return this.attendances.updateSettings(dto);
  }

  @Get('summary')
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceSummaryResponseDto })
  summary(@Query() query: QuerySummaryDto) {
    return this.attendances.summary(query);
  }

  @Get('export')
  @Roles(Role.ADMIN_HRD)
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description:
      'File CSV (UTF-8 dengan BOM), maks 5000 baris. Header X-Export-Truncated: true jika data terpotong.',
  })
  @Header('Cache-Control', 'private, no-store')
  async exportCsv(
    @Query() query: ExportAttendancesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { content, filename, truncated } = await this.attendances.exportCsv(query);
    res.setHeader('X-Export-Truncated', String(truncated));
    const body = Buffer.from(content, 'utf8');
    return new StreamableFile(body, {
      type: 'text/csv; charset=utf-8',
      length: body.length,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get()
  @Roles(Role.ADMIN_HRD)
  @ApiOkResponse({ type: AttendanceAdminListResponseDto })
  list(@Query() query: QueryAttendancesDto) {
    return this.attendances.list(query);
  }

  @Get(':id/photo')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary image stream' })
  @Header('Cache-Control', 'private, no-store')
  async photo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const { stream, mime, size } = await this.attendances.openPhoto(user, id);
    return new StreamableFile(stream, { type: mime, length: size, disposition: 'inline' });
  }
}

```

## backend\apps\api-gateway\src\attendances\attendances.module.ts
```
import { Module } from '@nestjs/common';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { PhotoStorageService } from './photo-storage.service';

@Module({
  controllers: [AttendancesController],
  providers: [AttendancesService, PhotoStorageService],
})
export class AttendancesModule {}


```

## backend\apps\api-gateway\src\auth\auth.controller.ts
```
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


```

## backend\apps\api-gateway\src\auth\auth.module.ts
```
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    // Urutan penting: autentikasi dulu, lalu otorisasi role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}


```

## backend\apps\api-gateway\src\clients\employee-service.client.ts
```
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthUser,
  CreateEmployeeDto,
  EMPLOYEE_SERVICE,
  EmployeeBrief,
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

  searchIds(search: string, limit: number) {
    return this.call<string[], { search: string; limit: number }>(
      EmployeePattern.EMPLOYEES_SEARCH_IDS,
      { search, limit },
    );
  }

  findBriefsByIds(ids: string[]) {
    return this.call<EmployeeBrief[], { ids: string[] }>(
      EmployeePattern.EMPLOYEES_FIND_BRIEFS,
      { ids },
    );
  }

  /** Karyawan aktif ber-role EMPLOYEE (tanpa ADMIN_HRD), terurut menurut nama. */
  findActiveStaff() {
    return this.call<EmployeeBrief[], Record<string, never>>(
      EmployeePattern.EMPLOYEES_FIND_ACTIVE_STAFF,
      {},
    );
  }
}

```

## backend\apps\api-gateway\src\clients\service-clients.module.ts
```
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ATTENDANCE_SERVICE, EMPLOYEE_SERVICE } from '@app/common';
import { AttendanceServiceClient } from './attendance-service.client';
import { EmployeeServiceClient } from './employee-service.client';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: EMPLOYEE_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.getOrThrow<string>('EMPLOYEE_SERVICE_HOST'),
            port: config.getOrThrow<number>('EMPLOYEE_SERVICE_PORT'),
          },
        }),
      },
      {
        name: ATTENDANCE_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.getOrThrow<string>('ATTENDANCE_SERVICE_HOST'),
            port: config.getOrThrow<number>('ATTENDANCE_SERVICE_PORT'),
          },
        }),
      },
    ]),
  ],
  providers: [EmployeeServiceClient, AttendanceServiceClient],
  exports: [EmployeeServiceClient, AttendanceServiceClient],
})
export class ServiceClientsModule {}

```

## backend\apps\api-gateway\src\employees\employees.controller.ts
```
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateEmployeeDto,
  EmployeeListResponseDto,
  EmployeeResponseDto,
  QueryEmployeesDto,
  Role,
  UpdateEmployeeDto,
} from '@app/common';
import { EmployeeServiceClient } from '../clients/employee-service.client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('employees')
@ApiBearerAuth()
@Roles(Role.ADMIN_HRD)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeeServiceClient) {}

  @Get()
  @ApiOkResponse({ type: EmployeeListResponseDto })
  findAll(@Query() query: QueryEmployeesDto) {
    return this.employees.findAll(query);
  }

  @Post()
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: EmployeeResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: EmployeeResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: EmployeeResponseDto, description: 'Soft delete (isActive=false)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.remove(id);
  }
}


```

## backend\apps\api-gateway\src\employees\employees.module.ts
```
import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';

@Module({ controllers: [EmployeesController] })
export class EmployeesModule {}


```

## backend\apps\api-gateway\src\time\time.module.ts
```
import { Module } from '@nestjs/common';
import { TimeController } from './time.controller';

@Module({ controllers: [TimeController] })
export class TimeModule {}


```

## backend\apps\employee-service\src\employees\employees.controller.ts
```
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AllRpcExceptionsFilter,
  CreateEmployeeDto,
  EmployeePattern,
  QueryEmployeesDto,
  UpdateEmployeeDto,
} from '@app/common';
import { EmployeesService } from './employees.service';

@Controller()
@UseFilters(AllRpcExceptionsFilter)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @MessagePattern(EmployeePattern.EMPLOYEES_CREATE)
  create(@Payload() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_ALL)
  findAll(@Payload() query: QueryEmployeesDto) {
    return this.employees.findAll(query);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_ONE)
  findOne(@Payload() payload: { id: string }) {
    return this.employees.findOne(payload.id);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_UPDATE)
  update(@Payload() payload: { id: string; data: UpdateEmployeeDto }) {
    return this.employees.update(payload.id, payload.data);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_REMOVE)
  remove(@Payload() payload: { id: string }) {
    return this.employees.remove(payload.id);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_SEARCH_IDS)
  searchIds(@Payload() payload: { search: string; limit: number }) {
    return this.employees.searchIds(payload.search, payload.limit);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_BRIEFS)
  findBriefs(@Payload() payload: { ids: string[] }) {
    return this.employees.findBriefsByIds(payload.ids);
  }

  @MessagePattern(EmployeePattern.EMPLOYEES_FIND_ACTIVE_STAFF)
  findActiveStaff() {
    return this.employees.findActiveStaff();
  }
}

```

## backend\apps\employee-service\src\employees\employees.service.ts
```
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Brackets, FindOptionsWhere, In, QueryFailedError, Repository } from 'typeorm';
import {
  CreateEmployeeDto,
  EmployeeBrief,
  EmployeeView,
  PaginatedResult,
  QueryEmployeesDto,
  Role,
  UpdateEmployeeDto,
} from '@app/common';
import { toEmployeeView } from './employee.mapper';
import { Employee } from './entities/employee.entity';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    private readonly config: ConfigService,
  ) {}

  private get rounds(): number {
    return this.config.getOrThrow<number>('BCRYPT_ROUNDS');
  }

  async create(dto: CreateEmployeeDto): Promise<EmployeeView> {
    const nik = dto.nik.trim();
    const email = dto.email.trim().toLowerCase();
    await this.assertUnique({ nik, email });

    const passwordHash = await bcrypt.hash(dto.password, this.rounds);
    try {
      const saved = await this.repo.save(
        this.repo.create({
          nik,
          fullName: dto.fullName,
          email,
          passwordHash,
          position: dto.position,
          role: dto.role,
          isActive: dto.isActive ?? true,
        }),
      );
      return toEmployeeView(saved);
    } catch (e) {
      throw this.translateDbError(e);
    }
  }

  async findAll(query: QueryEmployeesDto): Promise<PaginatedResult<EmployeeView>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const qb = this.repo.createQueryBuilder('e');
    if (query.search) {
      const like = `%${escapeLike(query.search)}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('e.fullName LIKE :like', { like })
            .orWhere('e.nik LIKE :like')
            .orWhere('e.email LIKE :like')
            .orWhere('e.position LIKE :like');
        }),
      );
    }
    if (query.position) {
      const posLike = `%${escapeLike(query.position)}%`;
      qb.andWhere('e.position LIKE :posLike', { posLike });
    }
    if (query.role) qb.andWhere('e.role = :role', { role: query.role });
    if (query.isActive !== undefined) {
      qb.andWhere('e.isActive = :isActive', { isActive: query.isActive });
    }

    const [rows, total] = await qb
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map(toEmployeeView),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<EmployeeView> {
    return toEmployeeView(await this.getEntity(id));
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeView> {
    const employee = await this.getEntity(id);

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== employee.email) {
        await this.assertUnique({ email }, id);
        employee.email = email;
      }
    }
    if (dto.fullName !== undefined) employee.fullName = dto.fullName;
    if (dto.position !== undefined) employee.position = dto.position;
    if (dto.role !== undefined) employee.role = dto.role;
    if (dto.isActive !== undefined) employee.isActive = dto.isActive;
    if (dto.password !== undefined) {
      employee.passwordHash = await bcrypt.hash(dto.password, this.rounds);
    }

    try {
      return toEmployeeView(await this.repo.save(employee));
    } catch (e) {
      throw this.translateDbError(e);
    }
  }

  /** Soft delete: isActive = false. */
  async remove(id: string): Promise<EmployeeView> {
    const employee = await this.getEntity(id);
    employee.isActive = false;
    return toEmployeeView(await this.repo.save(employee));
  }

  // ---- dipakai AuthService (bukan endpoint RPC) ----

  findByEmailWithPassword(email: string): Promise<Employee | null> {
    return this.repo
      .createQueryBuilder('e')
      .addSelect('e.passwordHash')
      .where('e.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  findEntityOrNull(id: string): Promise<Employee | null> {
    return this.repo.findOneBy({ id });
  }

  // ---- dipakai attendance lewat gateway (Fase 5B) ----

  /** ID karyawan (aktif maupun nonaktif) yang nama, NIK, atau jabatannya cocok. */
  async searchIds(search: string, limit: number): Promise<string[]> {
    const like = `%${escapeLike(search.trim())}%`;
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .where('e.fullName LIKE :like', { like })
      .orWhere('e.nik LIKE :like')
      .orWhere('e.position LIKE :like')
      .orderBy('e.id', 'ASC')
      .limit(limit)
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  /** Batch lookup satu query (bukan N+1). Tanpa filter isActive. */
  async findBriefsByIds(ids: string[]): Promise<EmployeeBrief[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({
      where: { id: In(ids) },
      select: { id: true, nik: true, fullName: true },
    });
    return rows.map((r) => ({ id: r.id, nik: r.nik, fullName: r.fullName }));
  }

  // ---- dipakai summary harian lewat gateway (Fase 5.5) ----

  /**
   * Populasi yang wajib absen: aktif DAN role EMPLOYEE (ADMIN_HRD tidak dihitung).
   * Satu query, terurut menurut nama.
   */
  async findActiveStaff(): Promise<EmployeeBrief[]> {
    const rows = await this.repo.find({
      where: { isActive: true, role: Role.EMPLOYEE },
      select: { id: true, nik: true, fullName: true },
      order: { fullName: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => ({ id: r.id, nik: r.nik, fullName: r.fullName }));
  }

  // ---- private ----

  private async getEntity(id: string): Promise<Employee> {
    const employee = await this.repo.findOneBy({ id });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async assertUnique(
    fields: { nik?: string; email?: string },
    excludeId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Employee>[] = [];
    if (fields.nik) where.push({ nik: fields.nik });
    if (fields.email) where.push({ email: fields.email });
    if (where.length === 0) return;

    const found = await this.repo.find({
      where,
      select: { id: true, nik: true, email: true },
    });
    for (const f of found) {
      if (f.id === excludeId) continue;
      if (fields.nik && f.nik.toLowerCase() === fields.nik.toLowerCase()) {
        throw new ConflictException('NIK already registered');
      }
      if (fields.email && f.email.toLowerCase() === fields.email.toLowerCase()) {
        throw new ConflictException('Email already registered');
      }
    }
  }

  private translateDbError(e: unknown): unknown {
    if (
      e instanceof QueryFailedError &&
      (e.driverError as { code?: string } | undefined)?.code === 'ER_DUP_ENTRY'
    ) {
      return new ConflictException('NIK or email already registered');
    }
    return e;
  }
}

```

## backend\libs\common\src\constants\rpc.constants.ts
```
export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';
export const ATTENDANCE_SERVICE = 'ATTENDANCE_SERVICE';

export const EmployeePattern = {
  AUTH_LOGIN: 'auth.login',
  AUTH_VALIDATE: 'auth.validate',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_FIND_ALL: 'employees.findAll',
  EMPLOYEES_FIND_ONE: 'employees.findOne',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_REMOVE: 'employees.remove',
  EMPLOYEES_SEARCH_IDS: 'employees.searchIds',
  EMPLOYEES_FIND_BRIEFS: 'employees.findBriefs',
  EMPLOYEES_FIND_ACTIVE_STAFF: 'employees.findActiveStaff',
} as const;

export const AttendancePattern = {
  CREATE: 'attendances.create',
  FIND_TODAY: 'attendances.findToday',
  FIND_ALL: 'attendances.findAll',
  FIND_ONE: 'attendances.findOne',
  GET_SETTINGS: 'attendances.getSettings',
  UPDATE_SETTINGS: 'attendances.updateSettings',
  GET_DAILY_STATS: 'attendances.getDailyStats',
} as const;

export const TIMEZONE = 'Asia/Jakarta';

```

## backend\libs\common\src\dto\employee.dto.ts
```
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Role } from '../enums/role.enum';

const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const toBoolean = ({ value }: TransformFnParams) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateEmployeeDto {
  @ApiProperty({ example: '2000000002' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nik: string;

  @ApiProperty({ example: 'Ani Wijaya' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: 'ani@company.test' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'Karyawan123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'QA Engineer' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position: string;

  @ApiProperty({ enum: Role, example: Role.EMPLOYEE })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** NIK tidak bisa diubah. Field nik yang dikirim akan dibuang oleh whitelist. */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['nik'] as const),
) {}

export class QueryEmployeesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Cari di nama, NIK, email, atau jabatan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter jabatan' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class EmployeeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() position: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class PaginationMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class EmployeeListResponseDto {
  @ApiProperty({ type: [EmployeeResponseDto] }) data: EmployeeResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}


```

## backend\libs\common\src\interfaces\employee.interface.ts
```
import { Role } from '../enums/role.enum';

export interface EmployeeView {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Data ringkas untuk memperkaya daftar absensi. */
export interface EmployeeBrief {
  id: string;
  nik: string;
  fullName: string;
}

```

## backend\package.json
```
{
  "name": "absensi-wfh-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build api-gateway && nest build employee-service && nest build attendance-service",
    "start:gateway": "nest start api-gateway --watch",
    "start:employee": "nest start employee-service --watch",
    "start:attendance": "nest start attendance-service --watch",
    "start:dev": "concurrently -n employee,attendance,gateway -c blue,magenta,green \"npm:start:employee\" \"npm:start:attendance\" \"npm:start:gateway\"",
    "start:prod:gateway": "node dist/apps/api-gateway/main",
    "start:prod:employee": "node dist/apps/employee-service/main",
    "start:prod:attendance": "node dist/apps/attendance-service/main",
    "seed": "ts-node -r tsconfig-paths/register apps/employee-service/src/database/seed.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.8",
    "@nestjs/config": "^3.2.2",
    "@nestjs/core": "^10.3.8",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/microservices": "^10.3.8",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.8",
    "@nestjs/swagger": "^7.3.1",
    "@nestjs/typeorm": "^10.0.2",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "dotenv": "^16.4.5",
    "helmet": "^7.1.0",
    "mysql2": "^3.9.7",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.2",
    "@nestjs/schematics": "^10.1.1",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.12.12",
    "@types/passport-jwt": "^4.0.1",
    "concurrently": "^8.2.2",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.4.5"
  }
}

```

