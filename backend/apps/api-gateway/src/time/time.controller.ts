import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { formatWibIso, TIMEZONE } from '@app/common';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('time')
@Controller('time')
export class TimeController {
  @Public()
  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        serverTimeWib: '2026-11-04T10:15:30+07:00',
        timezone: 'Asia/Jakarta',
        now: '2026-11-04T03:15:30.000Z',
        timeZone: 'Asia/Jakarta',
        date: '2026-11-04',
      },
    },
  })
  getTime() {
    const nowDate = new Date();
    const serverTimeWib = formatWibIso(nowDate);
    return {
      serverTimeWib,
      timezone: TIMEZONE,
      // Field kompatibilitas untuk frontend (useServerClock membaca `now`).
      now: nowDate.toISOString(),
      timeZone: TIMEZONE,
      date: serverTimeWib.slice(0, 10),
    };
  }
}

