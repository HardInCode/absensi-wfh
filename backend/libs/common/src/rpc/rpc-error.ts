import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { TimeoutError } from 'rxjs';

export interface RpcErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** Sisi SERVICE: ubah exception apa pun menjadi payload error yang bisa dikirim lewat TCP. */
export function toRpcErrorPayload(
  exception: unknown,
  logger?: Logger,
): RpcErrorPayload {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    if (typeof res === 'string') {
      return { statusCode: status, message: res };
    }
    const body = res as { message?: string | string[]; error?: string };
    return {
      statusCode: status,
      message: body.message ?? exception.message,
      error: body.error,
    };
  }

  if (exception instanceof RpcException) {
    const err = exception.getError();
    if (
      typeof err === 'object' &&
      err !== null &&
      typeof (err as RpcErrorPayload).statusCode === 'number'
    ) {
      return err as RpcErrorPayload;
    }
    return {
      statusCode: 500,
      message: typeof err === 'string' ? err : 'Internal server error',
    };
  }

  logger?.error(
    exception instanceof Error ? exception.stack : String(exception),
  );
  return { statusCode: 500, message: 'Internal server error' };
}

function isConnectionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    !!e &&
    (e.code === 'ECONNREFUSED' ||
      e.code === 'ECONNRESET' ||
      String(e.message ?? '').includes('ECONNREFUSED'))
  );
}

/** Sisi GATEWAY: ubah error dari TCP menjadi HttpException dengan status dan body yang sama. */
export function rpcErrorToHttp(err: unknown): HttpException {
  if (err instanceof HttpException) return err;
  if (err instanceof TimeoutError) {
    return new GatewayTimeoutException('Upstream service timed out');
  }
  const e = err as Partial<RpcErrorPayload> | null;
  if (e && typeof e.statusCode === 'number') {
    return new HttpException(
      { statusCode: e.statusCode, message: e.message, error: e.error },
      e.statusCode,
    );
  }
  if (isConnectionError(err)) {
    return new ServiceUnavailableException('Upstream service unavailable');
  }
  return new BadGatewayException('Unexpected upstream error');
}

