import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions, validateAttendanceServiceEnv } from '@app/common';
import { AttendancesModule } from './attendances/attendances.module';
import { AttendanceSettings } from './attendances/entities/attendance-settings.entity';
import { Attendance } from './attendances/entities/attendance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateAttendanceServiceEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildTypeOrmOptions(config, [Attendance, AttendanceSettings]),
    }),
    AttendancesModule,
  ],
})
export class AttendanceServiceModule {}
