import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions, validateEmployeeServiceEnv } from '@app/common';
import { AuthModule } from './auth/auth.module';
import { Employee } from './employees/entities/employee.entity';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEmployeeServiceEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildTypeOrmOptions(config, [Employee]),
    }),
    EmployeesModule,
    AuthModule,
  ],
})
export class EmployeeServiceModule {}

