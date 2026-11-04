import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';
import { rpcErrorToHttp } from './rpc-error';

export function sendRpc<TResult, TInput = unknown>(
  client: ClientProxy,
  pattern: string,
  data: TInput,
  timeoutMs = 5000,
): Promise<TResult> {
  return firstValueFrom(
    client.send<TResult, TInput>(pattern, data).pipe(
      timeout(timeoutMs),
      catchError((err) => throwError(() => rpcErrorToHttp(err))),
    ),
  );
}

