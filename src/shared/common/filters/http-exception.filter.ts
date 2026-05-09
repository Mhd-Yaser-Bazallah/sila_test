import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface NormalizedErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    response.status(statusCode).send({
      success: false,
      statusCode,
      message: this.getMessage(exceptionResponse, statusCode),
      errors: this.getErrors(exceptionResponse, statusCode),
    } satisfies NormalizedErrorResponse);
  }

  private getMessage(exceptionResponse: unknown, statusCode: number): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (this.isRecord(exceptionResponse)) {
      const message = exceptionResponse.message;

      if (Array.isArray(message)) {
        return message[0] ?? this.getDefaultMessage(statusCode);
      }

      if (typeof message === 'string') {
        return message;
      }

      if (typeof exceptionResponse.error === 'string') {
        return exceptionResponse.error;
      }
    }

    return this.getDefaultMessage(statusCode);
  }

  private getErrors(exceptionResponse: unknown, statusCode: number): unknown {
    if (this.isRecord(exceptionResponse)) {
      const message = exceptionResponse.message;

      if (Array.isArray(message)) {
        return message;
      }

      if (exceptionResponse.errors !== undefined) {
        return exceptionResponse.errors;
      }
    }

    return statusCode === HttpStatus.INTERNAL_SERVER_ERROR
      ? null
      : exceptionResponse;
  }

  private getDefaultMessage(statusCode: number): string {
    return statusCode === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error'
      : 'Request failed';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
