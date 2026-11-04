import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceSettingsService } from './attendance-settings.service';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { AttendanceSettings } from './entities/attendance-settings.entity';
import { Attendance } from './entities/attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, AttendanceSettings])],
  controllers: [AttendancesController],
  providers: [AttendancesService, AttendanceSettingsService],
})
export class AttendancesModule {}
