import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

const APP_TIME_ZONE = 'Asia/Jakarta';

@ApiTags('time')
@Controller('time')
export class TimeController {
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Waktu server saat ini (acuan jam di frontend)' })
  @ApiOkResponse({
    description: 'now = ISO 8601 UTC, date = tanggal WIB (YYYY-MM-DD)',
    schema: {
      example: {
        now: '2026-11-03T01:15:30.000Z',
        timeZone: 'Asia/Jakarta',
        date: '2026-11-03',
      },
    },
  })
  getTime() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    return { now: now.toISOString(), timeZone: APP_TIME_ZONE, date };
  }
}

