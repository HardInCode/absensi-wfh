import { Module } from '@nestjs/common';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { PhotoStorageService } from './photo-storage.service';

@Module({
  controllers: [AttendancesController],
  providers: [AttendancesService, PhotoStorageService],
})
export class AttendancesModule {}

