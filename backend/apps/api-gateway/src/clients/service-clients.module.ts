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
