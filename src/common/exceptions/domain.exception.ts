import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class DomainException extends HttpException {
  readonly code: string;

  constructor(code: string, detail: string, status: HttpStatus) {
    super(detail, status);
    this.code = code;
  }
}
