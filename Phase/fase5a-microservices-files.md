# Fase 5A: Gateway + Employee Service (File & Kode)

Instruksi untuk AI agent: lakukan langkah berikut secara berurutan. Fase ini mengubah backend monolit (Fase 1 dan 2) menjadi monorepo NestJS dengan `api-gateway` (HTTP :3000) dan `employee-service` (TCP :3001) yang berbagi `libs/common`. Buat setiap file pada path yang tertulis (relatif terhadap folder kerja) dengan isi persis seperti blok kode di bawahnya. Buat folder yang belum ada. File yang sudah ada dan disebut di bagian 1 ditimpa penuh. Frontend (Fase 3 dan 4) tidak diubah.

Catatan penting:
- Semua path di dokumen ini relatif terhadap `absensi-wfh/backend/` kecuali disebut lain.
- Fase 5A **belum** memuat modul absensi. Endpoint `/api/attendances*` tidak tersedia sampai Fase 5B (attendance-service). Akibatnya halaman karyawan `/absensi` dan halaman monitoring HRD di frontend belum berfungsi selama fase ini. Login, `/auth/me`, dan CRUD karyawan berfungsi penuh.
- Kode ditulis tanpa dijalankan. Setelah semua file dibuat, jalankan `npm run typecheck` dan perbaiki error compile bila ada tanpa mengubah perilaku yang dijelaskan di dokumen ini.

---

## 0. Persiapan: migrasi dari monolit

Jalankan dari `absensi-wfh/backend/`:

```bash
git checkout -b refactor/microservices
cp .env .env.backup            # jika .env ada

# Arsipkan kode monolit lama sebagai acuan untuk Fase 5B.
# Folder ini di luar "include" tsconfig sehingga tidak ikut dikompilasi.
mkdir -p legacy-src
mv src/* legacy-src/
rmdir src
```

Kode lama (terutama `legacy-src/attendances/`) akan dipakai ulang di Fase 5B. Jangan menghapusnya sekarang.

Jika database lama sudah berisi tabel dari monolit, cara paling mudah:

```bash
docker compose down -v
```

lalu ikuti bagian 6 (jalankan ulang MySQL dan seed). Skema tabel attendances dibahas di Fase 5B.

---

## 1. Konfigurasi proyek (timpa penuh)

### `absensi-wfh/backend/nest-cli.json`
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/api-gateway/src",
  "monorepo": true,
  "root": "apps/api-gateway",
  "compilerOptions": {
    "webpack": true,
    "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
  },
  "projects": {
    "api-gateway": {
      "type": "application",
      "root": "apps/api-gateway",
      "entryFile": "main",
      "sourceRoot": "apps/api-gateway/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
      }
    },
    "employee-service": {
      "type": "application",
      "root": "apps/employee-service",
      "entryFile": "main",
      "sourceRoot": "apps/employee-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/employee-service/tsconfig.app.json"
      }
    },
    "common": {
      "type": "library",
      "root": "libs/common",
      "entryFile": "index",
      "sourceRoot": "libs/common/src",
      "compilerOptions": {
        "tsConfigPath": "libs/common/tsconfig.lib.json"
      }
    }
  }
}
```

### `absensi-wfh/backend/package.json`
```json
{
  "name": "absensi-wfh-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "nest build api-gateway && nest build employee-service",
    "start:gateway": "nest start api-gateway --watch",
    "start:employee": "nest start employee-service --watch",
    "start:dev": "concurrently -n employee,gateway -c blue,green \"npm:start:employee\" \"npm:start:gateway\"",
    "start:prod:gateway": "node dist/apps/api-gateway/main",
    "start:prod:employee": "node dist/apps/employee-service/main",
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
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.4.5"
  }
}
```

### `absensi-wfh/backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@app/common": ["libs/common/src"],
      "@app/common/*": ["libs/common/src/*"]
    }
  },
  "include": ["apps/**/*", "libs/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `absensi-wfh/backend/tsconfig.build.json`
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### `absensi-wfh/backend/apps/api-gateway/tsconfig.app.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/api-gateway"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### `absensi-wfh/backend/apps/employee-service/tsconfig.app.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/employee-service"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### `absensi-wfh/backend/libs/common/tsconfig.lib.json`
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/common"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

---

## 2. `libs/common`

### `absensi-wfh/backend/libs/common/src/index.ts`
```ts
export * from './enums/role.enum';
export * from './constants/rpc.constants';
export * from './interfaces/auth.interface';
export * from './interfaces/employee.interface';
export * from './dto/auth.dto';
export * from './dto/employee.dto';
export * from './rpc/rpc-error';
export * from './rpc/rpc-exception.filter';
export * from './rpc/send-rpc';
export * from './config/env.validation';
export * from './database/typeorm.config';
export * from './utils/wib.util';
```

### `absensi-wfh/backend/libs/common/src/enums/role.enum.ts`
```ts
export enum Role {
  ADMIN_HRD = 'ADMIN_HRD',
  EMPLOYEE = 'EMPLOYEE',
}
```

### `absensi-wfh/backend/libs/common/src/constants/rpc.constants.ts`
```ts
export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';

export const EmployeePattern = {
  AUTH_LOGIN: 'auth.login',
  AUTH_VALIDATE: 'auth.validate',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_FIND_ALL: 'employees.findAll',
  EMPLOYEES_FIND_ONE: 'employees.findOne',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_REMOVE: 'employees.remove',
} as const;

export const TIMEZONE = 'Asia/Jakarta';
```

### `absensi-wfh/backend/libs/common/src/interfaces/auth.interface.ts`
```ts
import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}

/** Dipasang ke req.user oleh gateway (selalu hasil cek DB terbaru). */
export interface AuthUser {
  id: string;
  nik: string;
  fullName: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    nik: string;
    fullName: string;
    email: string;
    position: string;
    role: Role;
  };
}
```

### `absensi-wfh/backend/libs/common/src/interfaces/employee.interface.ts`
```ts
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
```

### `absensi-wfh/backend/libs/common/src/dto/auth.dto.ts`
```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Role } from '../enums/role.enum';

export class LoginDto {
  @ApiProperty({ example: 'admin@company.test' })
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class LoginUserDto {
  @ApiProperty() id: string;
  @ApiProperty() nik: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() position: string;
  @ApiProperty({ enum: Role }) role: Role;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: 28800 }) expiresIn: number;
  @ApiProperty({ type: LoginUserDto }) user: LoginUserDto;
}

export class MeResponseDto extends LoginUserDto {
  @ApiProperty() isActive: boolean;
}
```

### `absensi-wfh/backend/libs/common/src/dto/employee.dto.ts`
```ts
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

  @ApiPropertyOptional({ description: 'Cari di nama, NIK, atau email' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

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

### `absensi-wfh/backend/libs/common/src/rpc/rpc-error.ts`
```ts
import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { TimeoutError } from 'rxjs';

export interface RpcErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** Sisi SERVICE: ubah exception apa pun menjadi payload error yang bisa dikirim lewat TCP. */
export function toRpcErrorPayload(
  exception: unknown,
  logger?: Logger,
): RpcErrorPayload {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    if (typeof res === 'string') {
      return { statusCode: status, message: res };
    }
    const body = res as { message?: string | string[]; error?: string };
    return {
      statusCode: status,
      message: body.message ?? exception.message,
      error: body.error,
    };
  }

  if (exception instanceof RpcException) {
    const err = exception.getError();
    if (
      typeof err === 'object' &&
      err !== null &&
      typeof (err as RpcErrorPayload).statusCode === 'number'
    ) {
      return err as RpcErrorPayload;
    }
    return {
      statusCode: 500,
      message: typeof err === 'string' ? err : 'Internal server error',
    };
  }

  logger?.error(
    exception instanceof Error ? exception.stack : String(exception),
  );
  return { statusCode: 500, message: 'Internal server error' };
}

function isConnectionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    !!e &&
    (e.code === 'ECONNREFUSED' ||
      e.code === 'ECONNRESET' ||
      String(e.message ?? '').includes('ECONNREFUSED'))
  );
}

/** Sisi GATEWAY: ubah error dari TCP menjadi HttpException dengan status dan body yang sama. */
export function rpcErrorToHttp(err: unknown): HttpException {
  if (err instanceof HttpException) return err;
  if (err instanceof TimeoutError) {
    return new GatewayTimeoutException('Upstream service timed out');
  }
  const e = err as Partial<RpcErrorPayload> | null;
  if (e && typeof e.statusCode === 'number') {
    return new HttpException(
      { statusCode: e.statusCode, message: e.message, error: e.error },
      e.statusCode,
    );
  }
  if (isConnectionError(err)) {
    return new ServiceUnavailableException('Upstream service unavailable');
  }
  return new BadGatewayException('Unexpected upstream error');
}
```

### `absensi-wfh/backend/libs/common/src/rpc/rpc-exception.filter.ts`
```ts
import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { toRpcErrorPayload } from './rpc-error';

@Catch()
export class AllRpcExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('RpcExceptions');

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    return throwError(() => toRpcErrorPayload(exception, this.logger));
  }
}
```

### `absensi-wfh/backend/libs/common/src/rpc/send-rpc.ts`
```ts
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';
import { rpcErrorToHttp } from './rpc-error';

export function sendRpc<TResult, TInput = unknown>(
  client: ClientProxy,
  pattern: string,
  data: TInput,
  timeoutMs = 5000,
): Promise<TResult> {
  return firstValueFrom(
    client.send<TResult, TInput>(pattern, data).pipe(
      timeout(timeoutMs),
      catchError((err) => throwError(() => rpcErrorToHttp(err))),
    ),
  );
}
```

### `absensi-wfh/backend/libs/common/src/config/env.validation.ts`
```ts
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class SharedEnv {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  EMPLOYEE_SERVICE_HOST: string = '127.0.0.1';

  @IsInt()
  @Min(1)
  @Max(65535)
  EMPLOYEE_SERVICE_PORT: number = 3001;
}

export class GatewayEnv extends SharedEnv {
  @IsInt()
  @Min(1)
  @Max(65535)
  GATEWAY_PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL: string = 'http://localhost:5173';

  @IsInt()
  @Min(100)
  RPC_TIMEOUT_MS: number = 5000;
}

export class EmployeeServiceEnv extends SharedEnv {
  @IsString() @IsNotEmpty() DB_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) DB_PORT: number = 3306;
  @IsString() @IsNotEmpty() DB_NAME: string;
  @IsString() @IsNotEmpty() DB_USER: string;
  @IsString() @IsNotEmpty() DB_PASSWORD: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean = false;

  @IsInt() @Min(60) JWT_EXPIRES_IN_SECONDS: number = 28800;
  @IsInt() @Min(4) @Max(15) BCRYPT_ROUNDS: number = 10;
}

function createEnvValidator<T extends object>(cls: new () => T) {
  return (config: Record<string, unknown>): T => {
    const validated = plainToInstance(cls, config, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });
    const errors = validateSync(validated);
    if (errors.length > 0) {
      const detail = errors
        .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n');
      throw new Error(`Konfigurasi environment tidak valid:\n${detail}`);
    }
    return validated;
  };
}

export const validateGatewayEnv = createEnvValidator(GatewayEnv);
export const validateEmployeeServiceEnv = createEnvValidator(EmployeeServiceEnv);
```

### `absensi-wfh/backend/libs/common/src/database/typeorm.config.ts`
```ts
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmOptions(
  config: ConfigService,
  entities: NonNullable<TypeOrmModuleOptions['entities']>,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USER'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    entities,
    synchronize: config.getOrThrow<boolean>('DB_SYNCHRONIZE'),
    timezone: '+07:00',
    charset: 'utf8mb4',
  };
}
```

### `absensi-wfh/backend/libs/common/src/utils/wib.util.ts`
```ts
import { TIMEZONE } from '../constants/rpc.constants';

/** Waktu WIB dalam format ISO 8601 dengan offset, mis. 2026-11-04T10:15:30+07:00. */
export function formatWibIso(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+07:00`;
}
```

---

## 3. `employee-service` (TCP :3001)

### `absensi-wfh/backend/apps/employee-service/src/main.ts`
```ts
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { EmployeeServiceModule } from './employee-service.module';

async function bootstrap() {
  // Bind ke 127.0.0.1 secara default: port TCP tidak bisa diakses dari luar mesin.
  const host = process.env.EMPLOYEE_SERVICE_HOST ?? '127.0.0.1';
  const port = Number(process.env.EMPLOYEE_SERVICE_PORT ?? 3001);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EmployeeServiceModule,
    { transport: Transport.TCP, options: { host, port } },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`employee-service (TCP) listening on ${host}:${port}`, 'Bootstrap');
}

bootstrap();
```

### `absensi-wfh/backend/apps/employee-service/src/employee-service.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions, validateEmployeeServiceEnv } from '@app/common';
import { AuthModule } from './auth/auth.module';
import { Employee } from './employees/entities/employee.entity';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEmployeeServiceEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildTypeOrmOptions(config, [Employee]),
    }),
    EmployeesModule,
    AuthModule,
  ],
})
export class EmployeeServiceModule {}
```

### `absensi-wfh/backend/apps/employee-service/src/employees/entities/employee.entity.ts`
```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '@app/common';

@Entity({ name: 'employees' })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  nik: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  /** select:false, hanya dimuat saat diminta eksplisit (login). */
  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  position: string;

  @Column({ type: 'enum', enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
```

### `absensi-wfh/backend/apps/employee-service/src/employees/employee.mapper.ts`
```ts
import { EmployeeView } from '@app/common';
import { Employee } from './entities/employee.entity';

/** Satu-satunya pintu keluar data karyawan. passwordHash tidak pernah ikut. */
export function toEmployeeView(e: Employee): EmployeeView {
  return {
    id: e.id,
    nik: e.nik,
    fullName: e.fullName,
    email: e.email,
    position: e.position,
    role: e.role,
    isActive: e.isActive,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}
```

### `absensi-wfh/backend/apps/employee-service/src/employees/employees.service.ts`
```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Brackets, FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import {
  CreateEmployeeDto,
  EmployeeView,
  PaginatedResult,
  QueryEmployeesDto,
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
            .orWhere('e.email LIKE :like');
        }),
      );
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

### `absensi-wfh/backend/apps/employee-service/src/employees/employees.controller.ts`
```ts
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
}
```

### `absensi-wfh/backend/apps/employee-service/src/employees/employees.module.ts`
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee])],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
```

### `absensi-wfh/backend/apps/employee-service/src/auth/auth.service.ts`
```ts
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
```

### `absensi-wfh/backend/apps/employee-service/src/auth/auth.controller.ts`
```ts
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
```

### `absensi-wfh/backend/apps/employee-service/src/auth/auth.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmployeesModule } from '../employees/employees.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    EmployeesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

### `absensi-wfh/backend/apps/employee-service/src/database/seed.ts`
```ts
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '@app/common';
import { EmployeeServiceModule } from '../employee-service.module';
import { Employee } from '../employees/entities/employee.entity';

const DEMO_ACCOUNTS = [
  {
    nik: '1000000001',
    fullName: 'Admin HRD',
    email: 'admin@company.test',
    password: 'Admin123!',
    position: 'HRD Manager',
    role: Role.ADMIN_HRD,
  },
  {
    nik: '2000000001',
    fullName: 'Budi Santoso',
    email: 'budi@company.test',
    password: 'Karyawan123!',
    position: 'Software Engineer',
    role: Role.EMPLOYEE,
  },
];

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(EmployeeServiceModule, {
    logger: ['error', 'warn'],
  });
  try {
    const repo = app.get<Repository<Employee>>(getRepositoryToken(Employee));
    const rounds = app.get(ConfigService).getOrThrow<number>('BCRYPT_ROUNDS');

    for (const acc of DEMO_ACCOUNTS) {
      const exists = await repo.findOneBy({ email: acc.email });
      if (exists) {
        logger.log(`Lewati (sudah ada): ${acc.email}`);
        continue;
      }
      await repo.save(
        repo.create({
          nik: acc.nik,
          fullName: acc.fullName,
          email: acc.email,
          passwordHash: await bcrypt.hash(acc.password, rounds),
          position: acc.position,
          role: acc.role,
          isActive: true,
        }),
      );
      logger.log(`Dibuat: ${acc.email} (${acc.role})`);
    }
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## 4. `api-gateway` (HTTP :3000)

### `absensi-wfh/backend/apps/api-gateway/src/main.ts`
```ts
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

### `absensi-wfh/backend/apps/api-gateway/src/api-gateway.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateGatewayEnv } from '@app/common';
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
    TimeModule,
  ],
})
export class ApiGatewayModule {}
```

### `absensi-wfh/backend/apps/api-gateway/src/clients/service-clients.module.ts`
```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EMPLOYEE_SERVICE } from '@app/common';
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
    ]),
  ],
  providers: [EmployeeServiceClient],
  exports: [EmployeeServiceClient],
})
export class ServiceClientsModule {}
```

### `absensi-wfh/backend/apps/api-gateway/src/clients/employee-service.client.ts`
```ts
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
```

### `absensi-wfh/backend/apps/api-gateway/src/common/decorators/public.decorator.ts`
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### `absensi-wfh/backend/apps/api-gateway/src/common/decorators/roles.decorator.ts`
```ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@app/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### `absensi-wfh/backend/apps/api-gateway/src/common/decorators/current-user.decorator.ts`
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@app/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
```

### `absensi-wfh/backend/apps/api-gateway/src/auth/guards/jwt-auth.guard.ts`
```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/** Guard global: semua endpoint butuh Bearer token kecuali yang ditandai @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/auth/guards/roles.guard.ts`
```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, Role } from '@app/common';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();
    return !!user && required.includes(user.role); // false -> 403 Forbidden
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/auth/strategies/jwt.strategy.ts`
```ts
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
```

### `absensi-wfh/backend/apps/api-gateway/src/auth/auth.controller.ts`
```ts
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

### `absensi-wfh/backend/apps/api-gateway/src/auth/auth.module.ts`
```ts
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

### `absensi-wfh/backend/apps/api-gateway/src/employees/employees.controller.ts`
```ts
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

### `absensi-wfh/backend/apps/api-gateway/src/employees/employees.module.ts`
```ts
import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';

@Module({ controllers: [EmployeesController] })
export class EmployeesModule {}
```

### `absensi-wfh/backend/apps/api-gateway/src/time/time.controller.ts`
PENYESUAIAN dari dokumen sumber: respons ditambah field `now`, `timeZone`, dan `date` agar `useServerClock` di frontend Fase 3 (membaca `data.now`) tetap berfungsi. Field `serverTimeWib` dan `timezone` dari dokumen sumber tetap ada.
```ts
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { formatWibIso, TIMEZONE } from '@app/common';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('time')
@Controller('time')
export class TimeController {
  @Public()
  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        serverTimeWib: '2026-11-04T10:15:30+07:00',
        timezone: 'Asia/Jakarta',
        now: '2026-11-04T03:15:30.000Z',
        timeZone: 'Asia/Jakarta',
        date: '2026-11-04',
      },
    },
  })
  getTime() {
    const nowDate = new Date();
    const serverTimeWib = formatWibIso(nowDate);
    return {
      serverTimeWib,
      timezone: TIMEZONE,
      // Field kompatibilitas untuk frontend (useServerClock membaca `now`).
      now: nowDate.toISOString(),
      timeZone: TIMEZONE,
      date: serverTimeWib.slice(0, 10),
    };
  }
}
```

### `absensi-wfh/backend/apps/api-gateway/src/time/time.module.ts`
```ts
import { Module } from '@nestjs/common';
import { TimeController } from './time.controller';

@Module({ controllers: [TimeController] })
export class TimeModule {}
```

---

## 5. Docker Compose dan `.env`

Docker Compose tetap hanya menjalankan MySQL. Dua service Node berjalan lewat npm, dan port TCP 3001 tidak dipublikasikan ke luar: service mengikat `127.0.0.1`.

### `absensi-wfh/backend/docker-compose.yml` (timpa penuh)
```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: absensi-mysql
    restart: unless-stopped
    command:
      - --default-time-zone=+07:00
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: absensi_wfh
      MYSQL_USER: absensi_user
      MYSQL_PASSWORD: absensi_pass
      TZ: Asia/Jakarta
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-prootpass"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  mysql_data:
```

### `absensi-wfh/backend/.env.example` (timpa penuh, lalu salin ke `.env`)
```env
NODE_ENV=development

# ---- api-gateway (HTTP) ----
# Catatan: variabel lama PORT diganti GATEWAY_PORT
GATEWAY_PORT=3000
FRONTEND_URL=http://localhost:5173
RPC_TIMEOUT_MS=5000

# ---- employee-service (TCP, internal) ----
EMPLOYEE_SERVICE_HOST=127.0.0.1
EMPLOYEE_SERVICE_PORT=3001

# ---- attendance-service (dipakai di 5B) ----
# ATTENDANCE_SERVICE_HOST=127.0.0.1
# ATTENDANCE_SERVICE_PORT=3002
# UPLOAD_DIR=./uploads

# ---- Database (hanya dipakai employee-service di 5A) ----
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=absensi_wfh
DB_USER=absensi_user
DB_PASSWORD=absensi_pass
DB_SYNCHRONIZE=true

# ---- JWT (secret SAMA dipakai gateway untuk verifikasi dan employee-service untuk menandatangani) ----
JWT_SECRET=ganti-dengan-string-acak-minimal-32-karakter-ya
JWT_EXPIRES_IN_SECONDS=28800
BCRYPT_ROUNDS=10
```

---

## 6. Perintah menjalankan

```bash
cd absensi-wfh/backend
docker compose up -d                 # tunggu status mysql "healthy"
cp .env.example .env                 # lalu ganti JWT_SECRET dengan string acak (min. 32 karakter)
npm install
npm run typecheck                    # harus 0 error
npm run seed                         # membuat tabel employees + 2 akun demo (idempoten)
npm run start:dev                    # employee-service (:3001) + api-gateway (:3000)
# atau di 2 terminal: npm run start:employee  dan  npm run start:gateway
```

Swagger: http://localhost:3000/api/docs. Frontend tidak diubah dan tetap memakai `http://localhost:3000/api`.

---

## 7. Cara mengetes

**Via Swagger.**
1. `POST /api/auth/login` dengan `admin@company.test` / `Admin123!`. Salin `accessToken`, klik **Authorize**, lalu tempel token.
2. `GET /api/auth/me` mengembalikan data admin dengan `isActive`.
3. `POST /api/employees` (nik `2000000002`, email `ani@company.test`, password `Karyawan123!`, role `EMPLOYEE`) mengembalikan 201 tanpa password.
4. `GET /api/employees?page=1&limit=10&search=ani` mengembalikan `{ data, meta }`.
5. `PATCH /api/employees/{id}` mengubah `position`. `DELETE /api/employees/{id}` mengembalikan `isActive:false`.

**Via curl (kasus negatif).**
```bash
B=http://localhost:3000/api
# 1) login salah -> 401
curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@company.test","password":"salah"}'
# 2) token karyawan ke endpoint admin -> 403
T=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"budi@company.test","password":"Karyawan123!"}' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
curl -s -o /dev/null -w "%{http_code}\n" $B/employees -H "Authorization: Bearer $T"
# 3) tanpa token -> 401 ; /api/time publik -> 200
curl -s -o /dev/null -w "%{http_code}\n" $B/employees
curl -s $B/time
# 4) email duplikat -> 409 ; id bukan UUID -> 400
```

**Skenario lain.**
- Nonaktifkan Budi lewat `DELETE`. Token lama Budi langsung ditolak (401), dan login baru menghasilkan 403.
- Matikan `employee-service`, lalu `GET /api/employees` mengembalikan 503 (`Upstream service unavailable`).
- Port 3001 hanya bisa dijangkau dari mesin yang sama (bind 127.0.0.1).
- `GET /api/time` mengembalikan `serverTimeWib`, `timezone`, `now`, `timeZone`, dan `date`.

**Dengan frontend (opsional, `npm run dev` di `frontend/`).**
- Login admin dan CRUD karyawan di `/hrd/employees` (atau `/admin/karyawan`) harus berfungsi.
- Jam live di halaman karyawan berlabel "Sinkron dengan server" (berkat field `now`).
- Halaman `/absensi` (karyawan) dan `/hrd/monitoring` menampilkan error/kosong sampai Fase 5B, karena `/api/attendances*` belum ada.

---

## 8. Ringkasan file

**Ditimpa:** `nest-cli.json`, `package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`.

**Baru:**
```
tsconfig.build.json
libs/common/tsconfig.lib.json
libs/common/src/index.ts
libs/common/src/enums/role.enum.ts
libs/common/src/constants/rpc.constants.ts
libs/common/src/interfaces/auth.interface.ts
libs/common/src/interfaces/employee.interface.ts
libs/common/src/dto/auth.dto.ts
libs/common/src/dto/employee.dto.ts
libs/common/src/rpc/rpc-error.ts
libs/common/src/rpc/rpc-exception.filter.ts
libs/common/src/rpc/send-rpc.ts
libs/common/src/config/env.validation.ts
libs/common/src/database/typeorm.config.ts
libs/common/src/utils/wib.util.ts
apps/employee-service/tsconfig.app.json
apps/employee-service/src/main.ts
apps/employee-service/src/employee-service.module.ts
apps/employee-service/src/employees/employees.module.ts
apps/employee-service/src/employees/employees.controller.ts
apps/employee-service/src/employees/employees.service.ts
apps/employee-service/src/employees/employee.mapper.ts
apps/employee-service/src/employees/entities/employee.entity.ts
apps/employee-service/src/auth/auth.module.ts
apps/employee-service/src/auth/auth.controller.ts
apps/employee-service/src/auth/auth.service.ts
apps/employee-service/src/database/seed.ts
apps/api-gateway/tsconfig.app.json
apps/api-gateway/src/main.ts
apps/api-gateway/src/api-gateway.module.ts
apps/api-gateway/src/clients/service-clients.module.ts
apps/api-gateway/src/clients/employee-service.client.ts
apps/api-gateway/src/common/decorators/public.decorator.ts
apps/api-gateway/src/common/decorators/roles.decorator.ts
apps/api-gateway/src/common/decorators/current-user.decorator.ts
apps/api-gateway/src/auth/auth.module.ts
apps/api-gateway/src/auth/auth.controller.ts
apps/api-gateway/src/auth/guards/jwt-auth.guard.ts
apps/api-gateway/src/auth/guards/roles.guard.ts
apps/api-gateway/src/auth/strategies/jwt.strategy.ts
apps/api-gateway/src/employees/employees.module.ts
apps/api-gateway/src/employees/employees.controller.ts
apps/api-gateway/src/time/time.module.ts
apps/api-gateway/src/time/time.controller.ts
```

**Dipindahkan (diarsipkan):** seluruh `src/` lama menjadi `legacy-src/` (acuan untuk Fase 5B, tidak dikompilasi).

---

## 9. Keputusan default dan hal yang perlu dicek

1. **Siapa menandatangani JWT:** `employee-service` (pemilik auth). Gateway hanya memverifikasi dengan `JWT_SECRET` yang sama.
2. **Cek akun aktif di setiap request:** gateway memanggil `auth.validate` (satu TCP call) agar akun nonaktif langsung ditolak, sama seperti perilaku monolit. Jika kelak terasa berat, bisa diganti cache pendek.
3. **Seeder** dijalankan oleh `employee-service` (`npm run seed`) karena hanya ia yang memiliki data karyawan.
4. **Validasi DTO hanya di gateway.** Service mempercayai payload dari gateway, tetapi tetap memeriksa keunikan dan menangkap `ER_DUP_ENTRY`.
5. **Login akun nonaktif mengembalikan 403** (hanya setelah password benar, agar tidak membocorkan status akun). Login sukses memakai HTTP 200. Samakan dengan perilaku monolit jika berbeda.
6. **Bentuk data:** `serverTimeWib` dan Employee diasumsikan ISO dengan offset `+07:00` dan `{id, nik, fullName, email, position, role, isActive, createdAt, updatedAt}`. Jika monolit lama berformat lain, sesuaikan di `wib.util.ts` dan `employee.mapper.ts` agar frontend tidak pecah.
7. **Aturan password:** minimal 8 dan maksimal 72 karakter (batas bcrypt).
8. **TCP tanpa autentikasi**, aman karena hanya bind ke `127.0.0.1`. Jika nanti di-container, pakai jaringan Docker internal tanpa `ports`.
9. **Query filter karyawan memakai camelCase `isActive`** (bukan `is_active`). Frontend Fase 4 hanya mengirim `page`, `limit`, `search`, jadi aman. Halaman karyawan versi Fase 3 yang mengirim `is_active` akan diabaikan (whitelist membuang field itu) sehingga filter status tidak berpengaruh, tetapi tidak error.
10. **Belum ada di 5A** (sengaja, untuk 5B): pattern `employees.searchIds` dan `employees.findByIds` di employee-service (filter nama dan pengayaan nama/NIK di daftar absensi), attendance-service, upload dan streaming foto di gateway, serta endpoint `/api/attendances*`.
11. **Token revocation** belum ada (di luar cakupan).

Setelah 5A lulus tes, lanjut ke **Fase 5B** (attendance-service, upload di gateway, filter nama beserta paginasinya).
