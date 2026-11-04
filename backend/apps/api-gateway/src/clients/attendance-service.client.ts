import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  ATTENDANCE_SERVICE,
  AttendancePattern,
  AttendanceRecord,
  AttendanceSettingsRecord,
  CreateAttendancePayload,
  DailyStatsPayload,
  DailyStatsResult,
  ListAttendancesPayload,
  PaginatedResult,
  UpdateAttendanceSettingsPayload,
  sendRpc,
} from '@app/common';

@Injectable()
export class AttendanceServiceClient {
  private readonly timeoutMs: number;

  constructor(
    @Inject(ATTENDANCE_SERVICE) private readonly client: ClientProxy,
    config: ConfigService,
  ) {
    this.timeoutMs = config.getOrThrow<number>('RPC_TIMEOUT_MS');
  }

  private call<R, D>(pattern: string, data: D): Promise<R> {
    return sendRpc<R, D>(this.client, pattern, data, this.timeoutMs);
  }

  create(payload: CreateAttendancePayload) {
    return this.call<AttendanceRecord, CreateAttendancePayload>(
      AttendancePattern.CREATE,
      payload,
    );
  }

  findToday(employeeId: string) {
    return this.call<AttendanceRecord | null, { employeeId: string }>(
      AttendancePattern.FIND_TODAY,
      { employeeId },
    );
  }

  findAll(payload: ListAttendancesPayload) {
    return this.call<PaginatedResult<AttendanceRecord>, ListAttendancesPayload>(
      AttendancePattern.FIND_ALL,
      payload,
    );
  }

  findOne(id: string) {
    return this.call<AttendanceRecord, { id: string }>(AttendancePattern.FIND_ONE, { id });
  }

  getSettings() {
    return this.call<AttendanceSettingsRecord, Record<string, never>>(
      AttendancePattern.GET_SETTINGS,
      {},
    );
  }

  updateSettings(payload: UpdateAttendanceSettingsPayload) {
    return this.call<AttendanceSettingsRecord, UpdateAttendanceSettingsPayload>(
      AttendancePattern.UPDATE_SETTINGS,
      payload,
    );
  }

  getDailyStats(payload: DailyStatsPayload) {
    return this.call<DailyStatsResult, DailyStatsPayload>(
      AttendancePattern.GET_DAILY_STATS,
      payload,
    );
  }
}
