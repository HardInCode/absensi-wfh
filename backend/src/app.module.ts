import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthModule } from './auth/auth.module';
import { AttendancesModule } from './attendances/attendances.module';
import { TimeModule } from './time/time.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    EmployeesModule,
    AuthModule,
    AttendancesModule,
    TimeModule,
  ],
})
export class AppModule {}
