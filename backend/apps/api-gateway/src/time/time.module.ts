import { Module } from '@nestjs/common';
import { TimeController } from './time.controller';

@Module({ controllers: [TimeController] })
export class TimeModule {}

