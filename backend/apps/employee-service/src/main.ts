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

