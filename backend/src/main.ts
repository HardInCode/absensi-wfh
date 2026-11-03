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
