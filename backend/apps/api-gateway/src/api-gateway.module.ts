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
