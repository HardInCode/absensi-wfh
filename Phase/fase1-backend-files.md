# Fase 1: Fondasi Backend (File & Kode)

Instruksi untuk AI agent: buat setiap file di bawah ini persis pada path yang tertulis (relatif terhadap folder kerja), dengan isi kode persis seperti blok kode di bawah path tersebut. Buat folder yang belum ada.

---

## Keputusan desain & alasannya (penting dipahami sebelum mengimplementasikan)

**Skema DB: `synchronize` untuk development.** Dikendalikan lewat env `DB_SYNCHRONIZE` dan dipaksa mati bila `NODE_ENV=production`. Alasan: dengan batas waktu 4 hari, entity `attendances` di Fase 2 langsung terbuat tanpa file migrasi manual. Risiko: `synchronize` bisa mengubah atau menghapus kolom bila entity berubah, jadi tidak aman untuk produksi. Untuk produksi, ganti ke migrasi TypeORM (`migration:generate` / `migration:run`). Hal ini perlu ditulis di README pada fase akhir.

- **`bcryptjs`, bukan `bcrypt`.** Hash yang dihasilkan adalah bcrypt standar, dan paketnya pure JS sehingga `npm install` tidak butuh kompilasi native (menghindari masalah di Windows/Alpine). Bisa diganti ke `bcrypt` tanpa mengubah format hash di DB.
- **Format JSON.** Body dan response memakai camelCase (`fullName`), sedangkan kolom DB snake_case. Query param memakai snake_case (`is_active`), agar konsisten dengan `date_from`, `date_to`, `employee_name` di Fase 2.
- **Paginasi.** Response berbentuk `{ data: [...], meta: { page, limit, total, totalPages } }`, default `limit=10`, maksimum 100.
- **Token JWT.** Masa berlaku 8 jam, dikirim lewat header `Authorization: Bearer`, tanpa refresh token. Data user dibaca ulang dari DB di setiap request (lihat `JwtStrategy.validate`), sehingga akun yang dinonaktifkan langsung kehilangan akses.
- **Akun nonaktif.** Login mengembalikan 403 (dicek setelah password benar agar status akun tidak bocor), dan token lama langsung 401.
- **Anti user enumeration.** Login selalu menjalankan `bcrypt.compare` (memakai hash palsu bila email tidak ada) dan memberi pesan sama "Email atau password salah".
- **`passwordHash` tidak pernah bocor.** Kolom memakai `select: false` (tidak ikut query kecuali diminta eksplisit saat login) dan `@Exclude()` + `ClassSerializerInterceptor` (tidak ikut response JSON).
- **Proteksi diri untuk admin.** Admin tidak bisa menonaktifkan akunnya sendiri atau menurunkan rolenya sendiri, supaya tidak terjadi kondisi tanpa admin.
- **Soft delete.** `DELETE /employees/:id` hanya mengubah `is_active=false`, data dan riwayat absensi tetap utuh. Reaktivasi lewat `PATCH` dengan `{"isActive": true}`.
- **Validasi ketat.** `ValidationPipe` memakai `whitelist` + `forbidNonWhitelisted` (field tambahan ditolak 400) dan `transform`.
- **Zona waktu WIB.** `process.env.TZ`, timezone koneksi TypeORM (`+07:00`), dan MySQL (`--default-time-zone=+07:00`) semuanya diset ke WIB agar konsisten.
- **Helmet.** `upgrade-insecure-requests` dimatikan agar Swagger UI tidak blank di Safari saat diakses lewat `http://localhost`.
- **Swagger** selalu aktif di `/api/docs`, termasuk production (dianggap wajar untuk tes teknis).
- **Belum ada rate limiting** pada `/auth/login`. Bisa ditambahkan (`@nestjs/throttler`) di fase akhir bila diinginkan.
- **Folder `uploads/`, entity Attendance, dan README** sengaja belum dibuat. Semuanya masuk Fase 2 dan fase akhir.

---

## Root

### `absensi-wfh/docker-compose.yml`
```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: absensi-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root_pass}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-absensi_wfh}
      MYSQL_USER: ${MYSQL_USER:-absensi_user}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-absensi_pass}
      TZ: Asia/Jakarta
    command:
      - --default-time-zone=+07:00
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
    ports:
      - "${DB_PORT:-3306}:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -u root -p$$MYSQL_ROOT_PASSWORD --silent"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

volumes:
  mysql_data:
```

### `absensi-wfh/.env.example`
```env
# Dipakai oleh docker-compose.yml
MYSQL_ROOT_PASSWORD=root_pass
MYSQL_DATABASE=absensi_wfh
MYSQL_USER=absensi_user
MYSQL_PASSWORD=absensi_pass
DB_PORT=3306
```

### `absensi-wfh/.gitignore`
```gitignore
node_modules/
dist/
.env
*.log
backend/uploads/*
!backend/uploads/.gitkeep
.DS_Store
```

---

## Backend: konfigurasi proyek

### `absensi-wfh/backend/package.json`
```json
{
  "name": "absensi-wfh-backend",
  "version": "1.0.0",
  "description": "Backend Aplikasi Absensi WFH & Monitoring Karyawan",
  "private": true,
  "license": "UNLICENSED",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "seed": "ts-node src/database/seeds/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.1",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/swagger": "^11.0.0",
    "@nestjs/typeorm": "^11.0.0",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "helmet": "^8.0.0",
    "mysql2": "^3.11.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/passport-jwt": "^4.0.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.0"
  }
}
```

### `absensi-wfh/backend/nest-cli.json`
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": ["@nestjs/swagger"]
  }
}
```

### `absensi-wfh/backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

### `absensi-wfh/backend/tsconfig.build.json`
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### `absensi-wfh/backend/.env.example`
```env
NODE_ENV=development
PORT=3000

# Origin frontend (pisahkan dengan koma bila lebih dari satu)
FRONTEND_URL=http://localhost:5173

# Harus sama dengan nilai di docker-compose (.env root)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=absensi_user
DB_PASSWORD=absensi_pass
DB_DATABASE=absensi_wfh

# true hanya untuk development. Otomatis diabaikan saat NODE_ENV=production
DB_SYNCHRONIZE=true

# Minimal 32 karakter. Contoh membuat: openssl rand -hex 32
JWT_SECRET=change-this-secret-to-a-long-random-string-before-use
JWT_EXPIRES_IN_SECONDS=28800
```

### `absensi-wfh/backend/.gitignore`
```gitignore
node_modules/
dist/
.env
*.tsbuildinfo
```

---

## Backend: source

### `absensi-wfh/backend/src/main.ts`
```ts
import { NestFactory, Reflector } from '@nestjs/core';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_TIMEZONE } from './common/constants/app.constants';

async function bootstrap() {
  // Seluruh proses Node memakai WIB.
  process.env.TZ = APP_TIMEZONE;

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  // Helmet. 'upgrade-insecure-requests' dimatikan agar Swagger UI tidak blank
  // di Safari saat diakses lewat http://localhost.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'upgrade-insecure-requests': null },
      },
    }),
  );

  const origins = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Menerapkan @Exclude() pada entity (mis. passwordHash) di semua response.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Absensi WFH & Monitoring Karyawan API')
    .setDescription('Dokumentasi REST API. Klik "Authorize" lalu isi token JWT dari /api/auth/login.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port);
  logger.log(`API berjalan di http://localhost:${port}/api`);
  logger.log(`Swagger di http://localhost:${port}/api/docs`);
}

bootstrap();
```

### `absensi-wfh/backend/src/app.module.ts`
```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, EmployeesModule, AuthModule],
})
export class AppModule {}
```

---

## Common

### `absensi-wfh/backend/src/common/constants/app.constants.ts`
```ts
export const APP_TIMEZONE = 'Asia/Jakarta';
export const APP_UTC_OFFSET = '+07:00';
export const BCRYPT_SALT_ROUNDS = 10;
```

### `absensi-wfh/backend/src/common/enums/role.enum.ts`
```ts
export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  ADMIN_HRD = 'ADMIN_HRD',
}
```

### `absensi-wfh/backend/src/common/decorators/roles.decorator.ts`
```ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### `absensi-wfh/backend/src/common/decorators/current-user.decorator.ts`
```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Employee } from '../../employees/entities/employee.entity';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Employee => {
    const request = ctx.switchToHttp().getRequest<{ user: Employee }>();
    return request.user;
  },
);
```

### `absensi-wfh/backend/src/common/transformers/string.transformers.ts`
```ts
import { TransformFnParams } from 'class-transformer';

export const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

export const trimLowerCase = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
```

### `absensi-wfh/backend/src/common/dto/pagination-query.dto.ts`
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
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
}
```

### `absensi-wfh/backend/src/common/interfaces/paginated-result.interface.ts`
```ts
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

## Config

### `absensi-wfh/backend/src/config/env.validation.ts`
```ts
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL: string = 'http://localhost:5173';

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 3306;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE: string;

  @IsIn(['true', 'false'])
  DB_SYNCHRONIZE: string = 'false';

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET minimal 32 karakter' })
  JWT_SECRET: string;

  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN_SECONDS: number = 28800;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  - ');
    throw new Error(`Konfigurasi environment tidak valid:\n  - ${details}`);
  }
  return validated;
}
```

### `absensi-wfh/backend/src/config/app-config.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
```

---

## Database

### `absensi-wfh/backend/src/database/database.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_UTC_OFFSET } from '../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const synchronize =
          config.get<string>('DB_SYNCHRONIZE') === 'true' && !isProduction;

        return {
          type: 'mysql' as const,
          host: config.getOrThrow<string>('DB_HOST'),
          port: Number(config.get('DB_PORT') ?? 3306),
          username: config.getOrThrow<string>('DB_USERNAME'),
          password: config.getOrThrow<string>('DB_PASSWORD'),
          database: config.getOrThrow<string>('DB_DATABASE'),
          charset: 'utf8mb4',
          // Zona waktu koneksi: konversi Date <-> DATETIME memakai WIB.
          timezone: APP_UTC_OFFSET,
          autoLoadEntities: true,
          synchronize,
          logging: isProduction ? ['error' as const] : ['error' as const, 'warn' as const],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
```

### `absensi-wfh/backend/src/database/seeds/seed.ts`
```ts
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../app.module';
import {
  APP_TIMEZONE,
  BCRYPT_SALT_ROUNDS,
} from '../../common/constants/app.constants';
import { Role } from '../../common/enums/role.enum';
import { Employee } from '../../employees/entities/employee.entity';

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
  process.env.TZ = APP_TIMEZONE;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const repo = app.get<Repository<Employee>>(getRepositoryToken(Employee));

    for (const account of DEMO_ACCOUNTS) {
      const exists = await repo.findOne({ where: { email: account.email } });
      if (exists) {
        console.log(`[seed] Lewati (sudah ada): ${account.email}`);
        continue;
      }

      await repo.save(
        repo.create({
          nik: account.nik,
          fullName: account.fullName,
          email: account.email,
          position: account.position,
          role: account.role,
          isActive: true,
          passwordHash: await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS),
        }),
      );
      console.log(`[seed] Dibuat: ${account.email} (${account.role})`);
    }
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error('[seed] Gagal:', error);
  process.exit(1);
});
```

---

## Employees

### `absensi-wfh/backend/src/employees/entities/employee.entity.ts`
```ts
import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  nik: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  // select:false -> tidak pernah ikut ter-query kecuali diminta eksplisit (login).
  // @Exclude()  -> tidak pernah ikut ke response JSON.
  @ApiHideProperty()
  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash?: string;

  @Column({ type: 'varchar', length: 100 })
  position: string;

  @Column({ type: 'enum', enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### `absensi-wfh/backend/src/employees/dto/create-employee.dto.ts`
```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { trim, trimLowerCase } from '../../common/transformers/string.transformers';

export class CreateEmployeeDto {
  @ApiProperty({ example: '3201012345670001' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'nik hanya boleh berisi huruf, angka, titik, strip, atau underscore',
  })
  nik: string;

  @ApiProperty({ example: 'Siti Aminah' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiProperty({ example: 'siti@company.test' })
  @Transform(trimLowerCase)
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: 'Rahasia123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // batas bcrypt
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password harus mengandung minimal satu huruf dan satu angka',
  })
  password: string;

  @ApiProperty({ example: 'UI Designer' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  position: string;

  @ApiPropertyOptional({ enum: Role, default: Role.EMPLOYEE })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
```

### `absensi-wfh/backend/src/employees/dto/update-employee.dto.ts`
```ts
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ description: 'false = nonaktifkan, true = aktifkan kembali' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### `absensi-wfh/backend/src/employees/dto/query-employee.dto.ts`
```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums/role.enum';
import { trim } from '../../common/transformers/string.transformers';

export class QueryEmployeeDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cari berdasarkan nama, NIK, atau email' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Filter status aktif (true/false). Kosong = semua.' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  is_active?: boolean;
}
```

### `absensi-wfh/backend/src/employees/employees.service.ts`
```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../common/constants/app.constants';
import { Role } from '../common/enums/role.enum';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    await this.assertUnique(dto.nik, dto.email);

    const entity = this.repo.create({
      nik: dto.nik,
      fullName: dto.fullName,
      email: dto.email,
      position: dto.position,
      role: dto.role ?? Role.EMPLOYEE,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
    });

    try {
      const saved = await this.repo.save(entity);
      return this.findOne(saved.id);
    } catch (error) {
      this.translateDbError(error);
    }
  }

  async findAll(query: QueryEmployeeDto): Promise<PaginatedResult<Employee>> {
    const { page, limit, search, role, is_active } = query;

    const qb = this.repo.createQueryBuilder('e');

    if (search) {
      const keyword = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('e.fullName LIKE :keyword')
            .orWhere('e.nik LIKE :keyword')
            .orWhere('e.email LIKE :keyword');
        }),
      ).setParameter('keyword', keyword);
    }
    if (role) {
      qb.andWhere('e.role = :role', { role });
    }
    if (is_active !== undefined) {
      qb.andWhere('e.isActive = :isActive', { isActive: is_active });
    }

    const [data, total] = await qb
      .orderBy('e.createdAt', 'DESC')
      .addOrderBy('e.fullName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.repo.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException('Karyawan tidak ditemukan');
    }
    return employee;
  }

  /** Dipakai JwtStrategy: token milik akun nonaktif/terhapus otomatis ditolak. */
  findActiveById(id: string): Promise<Employee | null> {
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  /** Dipakai login: satu-satunya tempat passwordHash ikut di-select. */
  findByEmailWithPassword(email: string): Promise<Employee | null> {
    return this.repo
      .createQueryBuilder('e')
      .addSelect('e.passwordHash')
      .where('e.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    currentUserId: string,
  ): Promise<Employee> {
    await this.findOne(id);

    if (id === currentUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException('Anda tidak dapat menonaktifkan akun sendiri');
      }
      if (dto.role && dto.role !== Role.ADMIN_HRD) {
        throw new BadRequestException('Anda tidak dapat menurunkan role akun sendiri');
      }
    }

    await this.assertUnique(dto.nik, dto.email, id);

    const changes: Partial<Employee> = {};
    if (dto.nik !== undefined) changes.nik = dto.nik;
    if (dto.fullName !== undefined) changes.fullName = dto.fullName;
    if (dto.email !== undefined) changes.email = dto.email;
    if (dto.position !== undefined) changes.position = dto.position;
    if (dto.role !== undefined) changes.role = dto.role;
    if (dto.isActive !== undefined) changes.isActive = dto.isActive;
    if (dto.password) {
      changes.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }

    if (Object.keys(changes).length > 0) {
      try {
        await this.repo.update(id, changes);
      } catch (error) {
        this.translateDbError(error);
      }
    }
    return this.findOne(id);
  }

  /** Soft delete: is_active = false. Data dan riwayat absensi tetap utuh. */
  async remove(id: string, currentUserId: string): Promise<Employee> {
    await this.findOne(id);

    if (id === currentUserId) {
      throw new BadRequestException('Anda tidak dapat menonaktifkan akun sendiri');
    }

    await this.repo.update(id, { isActive: false });
    return this.findOne(id);
  }

  private async assertUnique(
    nik?: string,
    email?: string,
    excludeId?: string,
  ): Promise<void> {
    const conditions: Array<{ nik?: string; email?: string }> = [];
    if (nik) conditions.push({ nik });
    if (email) conditions.push({ email });
    if (conditions.length === 0) return;

    const found = (
      await this.repo.find({
        where: conditions,
        select: { id: true, nik: true, email: true },
      })
    ).filter((e) => e.id !== excludeId);

    if (nik && found.some((e) => e.nik.toLowerCase() === nik.toLowerCase())) {
      throw new ConflictException('NIK sudah terdaftar');
    }
    if (email && found.some((e) => e.email.toLowerCase() === email.toLowerCase())) {
      throw new ConflictException('Email sudah terdaftar');
    }
  }

  /** Pengaman race condition: unique constraint DB tetap jadi penjaga terakhir. */
  private translateDbError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { code?: string }).code === 'ER_DUP_ENTRY'
    ) {
      throw new ConflictException('NIK atau email sudah terdaftar');
    }
    throw error;
  }
}
```

### `absensi-wfh/backend/src/employees/employees.controller.ts`
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN_HRD)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Tambah karyawan baru (ADMIN_HRD)' })
  create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar karyawan + paginasi & pencarian (ADMIN_HRD)' })
  findAll(@Query() query: QueryEmployeeDto): Promise<PaginatedResult<Employee>> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail karyawan (ADMIN_HRD)' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Employee> {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah data karyawan (ADMIN_HRD)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() currentUser: Employee,
  ): Promise<Employee> {
    return this.employeesService.update(id, dto, currentUser.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Nonaktifkan karyawan / soft delete (ADMIN_HRD)' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: Employee,
  ): Promise<Employee> {
    return this.employeesService.remove(id, currentUser.id);
  }
}
```

### `absensi-wfh/backend/src/employees/employees.module.ts`
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

---

## Auth

### `absensi-wfh/backend/src/auth/interfaces/jwt-payload.interface.ts`
```ts
import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  sub: string;
  role: Role;
}
```

### `absensi-wfh/backend/src/auth/dto/login.dto.ts`
```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLowerCase } from '../../common/transformers/string.transformers';

export class LoginDto {
  @ApiProperty({ example: 'admin@company.test' })
  @Transform(trimLowerCase)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
```

### `absensi-wfh/backend/src/auth/dto/login-response.dto.ts`
```ts
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from '../../employees/entities/employee.entity';

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 28800, description: 'Masa berlaku token dalam detik' })
  expiresIn: number;

  @ApiProperty({ type: () => Employee })
  user: Employee;
}
```

### `absensi-wfh/backend/src/auth/guards/jwt-auth.guard.ts`
```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### `absensi-wfh/backend/src/auth/guards/roles.guard.ts`
```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/** Harus dipasang SETELAH JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard) */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role: Role } }>();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Anda tidak memiliki akses ke resource ini');
    }
    return true;
  }
}
```

### `absensi-wfh/backend/src/auth/strategies/jwt.strategy.ts`
```ts
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
```

### `absensi-wfh/backend/src/auth/auth.service.ts`
```ts
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
```

### `absensi-wfh/backend/src/auth/auth.controller.ts`
```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Employee } from '../employees/entities/employee.entity';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login dan dapatkan JWT' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil user yang sedang login' })
  @ApiOkResponse({ type: Employee })
  me(@CurrentUser() user: Employee): Employee {
    return user;
  }
}
```

### `absensi-wfh/backend/src/auth/auth.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EmployeesModule } from '../employees/employees.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    EmployeesModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: Number(config.get('JWT_EXPIRES_IN_SECONDS') ?? 28800),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

---

## Cara menjalankan

```bash
# Dari root repo absensi-wfh/
cp .env.example .env
docker compose up -d
docker compose ps                      # tunggu status mysql: healthy

cd backend
cp .env.example .env                   # lalu ganti JWT_SECRET (openssl rand -hex 32)
npm install
npm run seed                           # membuat tabel (via synchronize) + 2 akun demo
npm run start:dev                      # API: http://localhost:3000/api
                                       # Swagger: http://localhost:3000/api/docs
```

Akun demo dari seed: `admin@company.test` / `Admin123!` (ADMIN_HRD) dan `budi@company.test` / `Karyawan123!` (EMPLOYEE).

## Cara mengetes

```bash
# 1. Login admin, simpan token (butuh jq)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.test","password":"Admin123!"}' | jq -r .accessToken)

# 2. Profil sendiri
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"

# 3. Tambah karyawan
curl -s -X POST http://localhost:3000/api/employees \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nik":"3000000001","fullName":"Siti Aminah","email":"siti@company.test","password":"Rahasia123","position":"UI Designer"}'

# 4. Daftar + paginasi + pencarian (nama/NIK/email)
curl -s "http://localhost:3000/api/employees?page=1&limit=10&search=siti" \
  -H "Authorization: Bearer $TOKEN"

# 5. Detail (ganti <ID> dengan id dari langkah 3)
curl -s http://localhost:3000/api/employees/<ID> -H "Authorization: Bearer $TOKEN"

# 6. Ubah data
curl -s -X PATCH http://localhost:3000/api/employees/<ID> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"position":"Senior UI Designer"}'

# 7. Soft delete (is_active menjadi false)
curl -s -X DELETE http://localhost:3000/api/employees/<ID> -H "Authorization: Bearer $TOKEN"

# 8. Filter hanya karyawan nonaktif
curl -s "http://localhost:3000/api/employees?is_active=false" -H "Authorization: Bearer $TOKEN"
```

Skenario yang harus diverifikasi:

| Skenario | Hasil yang diharapkan |
|---|---|
| Login `siti@company.test` setelah di-DELETE (password benar) | 403 "Akun Anda nonaktif" |
| Token Siti yang diambil sebelum DELETE, dipakai ke `/auth/me` | 401 (akun nonaktif langsung ditolak) |
| Login `budi@company.test` lalu `GET /api/employees` | 403 (role EMPLOYEE) |
| `GET /api/employees` tanpa token | 401 |
| Login password salah / email tidak ada | 401, pesan sama |
| POST dengan NIK atau email duplikat | 409 |
| POST dengan field tambahan (mis. `"isAdmin":true`) | 400 (`forbidNonWhitelisted`) |
| Cari tanda `passwordHash` di semua response | Tidak boleh ada |
| `GET /api/employees/abc` | 400 (bukan UUID) |
| Admin DELETE akunnya sendiri | 400 |

Cek zona waktu DB (harus menampilkan `+07:00` dan jam WIB):

```bash
docker exec absensi-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT @@global.time_zone, NOW();"'
```
