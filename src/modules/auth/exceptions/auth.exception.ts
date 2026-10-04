import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@common/exceptions/domain.exception';

/** Generic — same message for wrong password, unknown user, inactive account (no enumeration). */
export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('AUTH_INVALID_CREDENTIALS', 'Invalid credentials', HttpStatus.UNAUTHORIZED);
  }
}

export class UserAlreadyExistsException extends DomainException {
  constructor(userId: string) {
    super('AUTH_USER_EXISTS', `User ${userId} already exists`, HttpStatus.CONFLICT);
  }
}
