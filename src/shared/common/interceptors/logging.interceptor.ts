import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logRequest(
          request.method,
          request.url,
          response.statusCode,
          startedAt,
        );
      }),
      catchError((error: unknown) => {
        this.logRequest(
          request.method,
          request.url,
          this.getErrorStatusCode(error),
          startedAt,
        );

        return throwError(() => error);
      }),
    );
  }

  private logRequest(
    method: string,
    url: string,
    statusCode: number,
    startedAt: number,
  ): void {
    this.logger.log(
      `${method} ${url} ${statusCode} ${Date.now() - startedAt}ms`,
    );
  }

  private getErrorStatusCode(error: unknown): number {
    if (
      typeof error === 'object' &&
      error !== null &&
      'getStatus' in error &&
      typeof error.getStatus === 'function'
    ) {
      return error.getStatus();
    }

    return 500;
  }
}
