import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from '../exceptions/app.exception';

@Catch()
export class RuntimeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RuntimeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toAppException(exception);
    res.status(body.status).type('application/problem+json').json(body);
  }

  private toAppException(exception: unknown): AppException {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const raw = typeof r === 'string' ? r : (r as { message?: unknown }).message;
      const detail = Array.isArray(raw) ? raw.join(', ') : String(raw ?? exception.message);
      return { code: HttpStatus[status] ?? 'HTTP_ERROR', detail, status };
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return {
      code: 'INTERNAL_ERROR',
      detail: 'Internal server error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }
}
