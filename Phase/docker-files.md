# File untuk Docker

## docker-compose.yml
```
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
    "@nestjs/throttler": "^5.2.0",
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

## backend\nest-cli.json
```
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
    "attendance-service": {
      "type": "application",
      "root": "apps/attendance-service",
      "entryFile": "main",
      "sourceRoot": "apps/attendance-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/attendance-service/tsconfig.app.json"
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

## backend\tsconfig.json
```
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

## backend\.env.example
```
NODE_ENV=development

# ---- api-gateway (HTTP) ----
# Catatan: variabel lama PORT diganti GATEWAY_PORT
GATEWAY_PORT=3000
FRONTEND_URL=http://localhost:5173
RPC_TIMEOUT_MS=5000

# ---- employee-service (TCP, internal) ----
EMPLOYEE_SERVICE_HOST=127.0.0.1
EMPLOYEE_SERVICE_PORT=3001

# ---- attendance-service (TCP, internal) ----
ATTENDANCE_SERVICE_HOST=127.0.0.1
ATTENDANCE_SERVICE_PORT=3002

# ---- Upload foto (hanya dipakai gateway) ----
UPLOAD_DIR=./uploads

# ---- Database (dipakai employee-service dan attendance-service) ----
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

## frontend\package.json
```
{
  "name": "absensi-wfh-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fontsource-variable/dm-sans": "^5.1.0",
    "@fontsource-variable/fraunces": "^5.1.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "axios": "^1.7.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "~5.6.3",
    "vite": "^5.4.11"
  }
}

```

## frontend\vite.config.ts
```
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
});

```

## .gitignore
```
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/
out/

# Environment files (CRITICAL: jangan commit kredensial/rahasia)
.env
.env.local
.env.*.local
.env.backup
*.backup
backend/.env
frontend/.env

# Uploads data (hanya commit .gitkeep)
uploads/*
!uploads/.gitkeep
backend/uploads/*
!backend/uploads/.gitkeep

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Docker
.docker/

# OS and Editor
.DS_Store
Thumbs.db
.idea/
.vscode/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

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

## backend\apps\attendance-service\src\main.ts
```
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AttendanceServiceModule } from './attendance-service.module';

async function bootstrap() {
  // Bind 127.0.0.1: port TCP tidak terjangkau dari luar mesin.
  const host = process.env.ATTENDANCE_SERVICE_HOST ?? '127.0.0.1';
  const port = Number(process.env.ATTENDANCE_SERVICE_PORT ?? 3002);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AttendanceServiceModule,
    { transport: Transport.TCP, options: { host, port } },
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`attendance-service (TCP) listening on ${host}:${port}`, 'Bootstrap');
}

bootstrap();


```

## backend\apps\employee-service\src\main.ts
```
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

## backend\apps\employee-service\src\database\seed.ts
```
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
    logger: ['log', 'error', 'warn'],
  });
  try {
    const repo = app.get<Repository<Employee>>(getRepositoryToken(Employee));
    const rounds = app.get(ConfigService).getOrThrow<number>('BCRYPT_ROUNDS');

    for (const acc of DEMO_ACCOUNTS) {
      const exists = await repo.findOne({
        where: { email: acc.email },
        select: { id: true, email: true, passwordHash: true },
      });
      if (exists) {
        if (!exists.passwordHash || exists.passwordHash.length < 20) {
          exists.passwordHash = await bcrypt.hash(acc.password, rounds);
          await repo.save(exists);
          logger.log(`Password demo diperbarui: ${acc.email}`);
        } else {
          logger.log(`Lewati (sudah ada): ${acc.email}`);
        }
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

## backend\libs\common\src\config\env.validation.ts
```
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

class BaseEnv {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';
}

class DbEnv extends BaseEnv {
  @IsString() @IsNotEmpty() DB_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) DB_PORT: number = 3306;
  @IsString() @IsNotEmpty() DB_NAME: string;
  @IsString() @IsNotEmpty() DB_USER: string;
  @IsString() @IsNotEmpty() DB_PASSWORD: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  DB_SYNCHRONIZE: boolean = false;
}

export class GatewayEnv extends BaseEnv {
  @IsString() @MinLength(32) JWT_SECRET: string;

  @IsString() @IsNotEmpty() EMPLOYEE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) EMPLOYEE_SERVICE_PORT: number = 3001;
  @IsString() @IsNotEmpty() ATTENDANCE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) ATTENDANCE_SERVICE_PORT: number = 3002;

  @IsInt() @Min(1) @Max(65535) GATEWAY_PORT: number = 3000;
  @IsString() @IsNotEmpty() FRONTEND_URL: string = 'http://localhost:5173';
  @IsInt() @Min(100) RPC_TIMEOUT_MS: number = 5000;
  @IsString() @IsNotEmpty() UPLOAD_DIR: string = './uploads';
}

export class EmployeeServiceEnv extends DbEnv {
  @IsString() @MinLength(32) JWT_SECRET: string;
  @IsString() @IsNotEmpty() EMPLOYEE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) EMPLOYEE_SERVICE_PORT: number = 3001;
  @IsInt() @Min(60) JWT_EXPIRES_IN_SECONDS: number = 28800;
  @IsInt() @Min(4) @Max(15) BCRYPT_ROUNDS: number = 10;
}

export class AttendanceServiceEnv extends DbEnv {
  @IsString() @IsNotEmpty() ATTENDANCE_SERVICE_HOST: string = '127.0.0.1';
  @IsInt() @Min(1) @Max(65535) ATTENDANCE_SERVICE_PORT: number = 3002;
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
export const validateAttendanceServiceEnv = createEnvValidator(AttendanceServiceEnv);

```

## backend\libs\common\src\database\typeorm.config.ts
```
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

## frontend\src\lib\api.ts
```
import axios, { type AxiosError } from "axios";

export const TOKEN_KEY = "absensi.token";
export const AUTH_EXPIRED_EVENT = "auth:expired";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    if (status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export default api;

```

