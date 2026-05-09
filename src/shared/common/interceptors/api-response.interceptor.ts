import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface ApiResponseBody<T = unknown> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: unknown;
}

interface DataWithMeta<T = unknown> {
  data: T;
  meta?: unknown;
}

const HIDDEN_RESPONSE_KEYS = new Set([
  'passwordHash',
  'refreshTokenHash',
  'deletedAt',
]);

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseBody
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseBody> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((body: T | DataWithMeta) => {
        const statusCode = response.statusCode;
        const hasDataWithMeta = this.hasDataWithMeta(body);

        return {
          success: true,
          statusCode,
          message: 'Success',
          data: this.sanitize(hasDataWithMeta ? body.data : body),
          ...(hasDataWithMeta && body.meta !== undefined
            ? { meta: body.meta }
            : {}),
        };
      }),
    );
  }

  private hasDataWithMeta(value: unknown): value is DataWithMeta {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'meta' in value
    );
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (!this.isPlainObject(value)) {
      return value;
    }

    return Object.entries(value).reduce<Record<string, unknown>>(
      (sanitized, [key, item]) => {
        if (!HIDDEN_RESPONSE_KEYS.has(key)) {
          sanitized[key] = this.sanitize(item);
        }

        return sanitized;
      },
      {},
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || value instanceof Date) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }
}
