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

