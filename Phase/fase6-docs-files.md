# File untuk Fase 6

## Daftar file
```
backend\apps\api-gateway\tsconfig.app.json
backend\apps\api-gateway\src\api-gateway.module.ts
backend\apps\api-gateway\src\main.ts
backend\apps\api-gateway\src\attendances\attendance.mapper.ts
backend\apps\api-gateway\src\attendances\attendances.constants.ts
backend\apps\api-gateway\src\attendances\attendances.controller.ts
backend\apps\api-gateway\src\attendances\attendances.export.constants.ts
backend\apps\api-gateway\src\attendances\attendances.module.ts
backend\apps\api-gateway\src\attendances\attendances.service.ts
backend\apps\api-gateway\src\attendances\photo-storage.service.ts
backend\apps\api-gateway\src\attendances\dto\attendance.dto.ts
backend\apps\api-gateway\src\attendances\utils\csv.util.ts
backend\apps\api-gateway\src\attendances\utils\image-type.util.ts
backend\apps\api-gateway\src\auth\auth.controller.ts
backend\apps\api-gateway\src\auth\auth.module.ts
backend\apps\api-gateway\src\auth\guards\jwt-auth.guard.ts
backend\apps\api-gateway\src\auth\guards\roles.guard.ts
backend\apps\api-gateway\src\auth\strategies\jwt.strategy.ts
backend\apps\api-gateway\src\clients\attendance-service.client.ts
backend\apps\api-gateway\src\clients\employee-service.client.ts
backend\apps\api-gateway\src\clients\service-clients.module.ts
backend\apps\api-gateway\src\common\decorators\current-user.decorator.ts
backend\apps\api-gateway\src\common\decorators\public.decorator.ts
backend\apps\api-gateway\src\common\decorators\roles.decorator.ts
backend\apps\api-gateway\src\employees\employees.controller.ts
backend\apps\api-gateway\src\employees\employees.module.ts
backend\apps\api-gateway\src\time\time.controller.ts
backend\apps\api-gateway\src\time\time.module.ts
backend\apps\attendance-service\tsconfig.app.json
backend\apps\attendance-service\src\attendance-service.module.ts
backend\apps\attendance-service\src\main.ts
backend\apps\attendance-service\src\attendances\attendance-settings.service.ts
backend\apps\attendance-service\src\attendances\attendances.controller.ts
backend\apps\attendance-service\src\attendances\attendances.module.ts
backend\apps\attendance-service\src\attendances\attendances.service.ts
backend\apps\attendance-service\src\attendances\entities\attendance-settings.entity.ts
backend\apps\attendance-service\src\attendances\entities\attendance.entity.ts
backend\apps\employee-service\tsconfig.app.json
backend\apps\employee-service\src\employee-service.module.ts
backend\apps\employee-service\src\main.ts
backend\apps\employee-service\src\auth\auth.controller.ts
backend\apps\employee-service\src\auth\auth.module.ts
backend\apps\employee-service\src\auth\auth.service.ts
backend\apps\employee-service\src\database\seed.ts
backend\apps\employee-service\src\employees\employee.mapper.ts
backend\apps\employee-service\src\employees\employees.controller.ts
backend\apps\employee-service\src\employees\employees.module.ts
backend\apps\employee-service\src\employees\employees.service.ts
backend\apps\employee-service\src\employees\entities\employee.entity.ts
backend\libs\common\tsconfig.lib.json
backend\libs\common\src\index.ts
backend\libs\common\src\config\env.validation.ts
backend\libs\common\src\constants\rpc.constants.ts
backend\libs\common\src\database\typeorm.config.ts
backend\libs\common\src\dto\auth.dto.ts
backend\libs\common\src\dto\employee.dto.ts
backend\libs\common\src\enums\attendance-status.enum.ts
backend\libs\common\src\enums\role.enum.ts
backend\libs\common\src\interfaces\attendance.interface.ts
backend\libs\common\src\interfaces\auth.interface.ts
backend\libs\common\src\interfaces\employee.interface.ts
backend\libs\common\src\rpc\rpc-error.ts
backend\libs\common\src\rpc\rpc-exception.filter.ts
backend\libs\common\src\rpc\send-rpc.ts
backend\libs\common\src\utils\attendance-settings.util.ts
backend\libs\common\src\utils\wib.util.ts
frontend\src\App.tsx
frontend\src\index.css
frontend\src\main.tsx
frontend\src\vite-env.d.ts
frontend\src\auth\AuthContext.tsx
frontend\src\auth\ProtectedRoute.tsx
frontend\src\components\AttendanceStatusBadge.tsx
frontend\src\components\AttendanceSummaryCards.tsx
frontend\src\components\AuthedImage.tsx
frontend\src\components\CheckInWindowInfo.tsx
frontend\src\components\ConfirmDeactivateDialog.tsx
frontend\src\components\DataTable.tsx
frontend\src\components\EmployeeFormModal.tsx
frontend\src\components\EmptyState.tsx
frontend\src\components\ErrorState.tsx
frontend\src\components\FullPageLoader.tsx
frontend\src\components\icons.tsx
frontend\src\components\LiveClock.tsx
frontend\src\components\PageHeader.tsx
frontend\src\components\PageSpinner.tsx
frontend\src\components\Pagination.tsx
frontend\src\components\PhotoDropzone.tsx
frontend\src\components\PhotoLightbox.tsx
frontend\src\components\Stamp.tsx
frontend\src\components\StatusBanner.tsx
frontend\src\components\ui\badge.tsx
frontend\src\components\ui\button.tsx
frontend\src\components\ui\card.tsx
frontend\src\components\ui\dialog.tsx
frontend\src\components\ui\input.tsx
frontend\src\components\ui\label.tsx
frontend\src\components\ui\select.tsx
frontend\src\components\ui\skeleton.tsx
frontend\src\components\ui\textarea.tsx
frontend\src\hooks\useApiList.ts
frontend\src\hooks\useAttendanceSettings.ts
frontend\src\hooks\useDebounce.ts
frontend\src\hooks\useDebouncedValue.ts
frontend\src\hooks\usePagedQuery.ts
frontend\src\hooks\useProtectedImage.ts
frontend\src\hooks\useServerClock.ts
frontend\src\layouts\AppShell.tsx
frontend\src\lib\api.ts
frontend\src\lib\attendanceRules.ts
frontend\src\lib\errors.ts
frontend\src\lib\format.ts
frontend\src\lib\hrdApi.ts
frontend\src\lib\hrdFormat.ts
frontend\src\lib\routes.ts
frontend\src\lib\types.ts
frontend\src\lib\utils.ts
frontend\src\pages\LoginPage.tsx
frontend\src\pages\NotFoundPage.tsx
frontend\src\pages\employee\AttendancePage.tsx
frontend\src\pages\hrd\AttendanceSettingsPage.tsx
frontend\src\pages\hrd\EmployeesPage.tsx
frontend\src\pages\hrd\MonitoringPage.tsx
```
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

## backend\apps\api-gateway\src\time\time.controller.ts
```
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

## backend\apps\attendance-service\src\attendances\attendances.controller.ts
```
import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AllRpcExceptionsFilter,
  AttendancePattern,
  CreateAttendancePayload,
  DailyStatsPayload,
  ListAttendancesPayload,
  UpdateAttendanceSettingsPayload,
} from '@app/common';
import { AttendanceSettingsService } from './attendance-settings.service';
import { AttendancesService } from './attendances.service';

@Controller()
@UseFilters(AllRpcExceptionsFilter)
export class AttendancesController {
  constructor(
    private readonly attendances: AttendancesService,
    private readonly settings: AttendanceSettingsService,
  ) {}

  @MessagePattern(AttendancePattern.CREATE)
  create(@Payload() payload: CreateAttendancePayload) {
    return this.attendances.create(payload);
  }

  @MessagePattern(AttendancePattern.FIND_TODAY)
  findToday(@Payload() payload: { employeeId: string }) {
    return this.attendances.findToday(payload.employeeId);
  }

  @MessagePattern(AttendancePattern.FIND_ALL)
  findAll(@Payload() payload: ListAttendancesPayload) {
    return this.attendances.findAll(payload);
  }

  @MessagePattern(AttendancePattern.FIND_ONE)
  findOne(@Payload() payload: { id: string }) {
    return this.attendances.findOne(payload.id);
  }

  @MessagePattern(AttendancePattern.GET_SETTINGS)
  getSettings() {
    return this.settings.get();
  }

  @MessagePattern(AttendancePattern.UPDATE_SETTINGS)
  updateSettings(@Payload() payload: UpdateAttendanceSettingsPayload) {
    return this.settings.update(payload);
  }

  @MessagePattern(AttendancePattern.GET_DAILY_STATS)
  getDailyStats(@Payload() payload: DailyStatsPayload) {
    return this.attendances.getDailyStats(payload);
  }
}

```

## backend\apps\attendance-service\src\attendances\entities\attendance-settings.entity.ts
```
import { Column, Entity, PrimaryColumn } from 'typeorm';

export const ATTENDANCE_SETTINGS_ID = 1;

/** Konfigurasi global, selalu tepat satu baris (id = 1). */
@Entity({ name: 'attendance_settings' })
export class AttendanceSettings {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'earliest_check_in', type: 'varchar', length: 5 })
  earliestCheckIn: string;

  @Column({ name: 'default_cutoff_time', type: 'varchar', length: 5 })
  defaultCutoffTime: string;

  @Column({ name: 'tolerance_minutes', type: 'int' })
  toleranceMinutes: number;

  @Column({ name: 'require_note_when_late', type: 'boolean' })
  requireNoteWhenLate: boolean;

  /** 0 = Minggu ... 6 = Sabtu */
  @Column({ name: 'working_days', type: 'json' })
  workingDays: number[];

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}


```

## backend\apps\attendance-service\src\attendances\entities\attendance.entity.ts
```
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AttendanceStatus } from '@app/common';

@Entity({ name: 'attendances' })
@Unique('UQ_attendance_employee_date', ['employeeId', 'attendanceDate'])
@Index('IDX_attendance_date', ['attendanceDate'])
@Index('IDX_attendance_photo_hash', ['photoHash'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Referensi lunak ke employees.id (tanpa FK fisik lintas service). */
  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employeeId: string;

  @Column({ name: 'check_in_at', type: 'datetime' })
  checkInAt: Date;

  /** Tanggal kalender WIB, diturunkan dari checkInAt di server. */
  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'photo_path', type: 'varchar', length: 255 })
  photoPath: string;

  /** SHA-256 isi foto (hex). Null untuk data lama sebelum fitur anti-duplikat. */
  @Column({ name: 'photo_hash', type: 'varchar', length: 64, nullable: true })
  photoHash: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  /** Dihitung & disimpan saat absen. Tidak dihitung ulang saat pengaturan berubah. */
  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.ON_TIME,
  })
  status: AttendanceStatus;

  @Column({ name: 'late_minutes', type: 'int', default: 0 })
  lateMinutes: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}

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

## backend\apps\employee-service\src\auth\auth.controller.ts
```
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

## backend\apps\employee-service\src\employees\entities\employee.entity.ts
```
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

