// apps/api/src/common/interceptors/request-id.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ensures every request has an X-Request-Id header (generates one if absent)
 * and echoes it back in the response. The pino logger picks this up via
 * the request object and includes it in every log line for the request.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
    req.headers['x-request-id'] = requestId;

    return next.handle().pipe(
      tap(() => {
        res.setHeader('X-Request-Id', requestId);
      }),
    );
  }
}
