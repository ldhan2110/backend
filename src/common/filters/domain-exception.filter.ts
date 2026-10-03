import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';
import { AppException } from '../exceptions/app.exception';

/**
 * Business-rule violations thrown on purpose. Emits the exception's own
 * stable `code` + `detail` + `status`. Must out-rank the runtime catch-all
 * (registered last — see main.ts).
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body: AppException = {
      code: exception.code,
      detail: exception.message,
      status: exception.getStatus(),
    };
    res.status(body.status).type('application/problem+json').json(body);
  }
}
