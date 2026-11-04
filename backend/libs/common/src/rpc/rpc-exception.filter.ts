import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { toRpcErrorPayload } from './rpc-error';

@Catch()
export class AllRpcExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('RpcExceptions');

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    return throwError(() => toRpcErrorPayload(exception, this.logger));
  }
}

