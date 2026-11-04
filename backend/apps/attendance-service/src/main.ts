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

