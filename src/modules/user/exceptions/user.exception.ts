import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@common/exceptions/domain.exception';

export class UserNotFoundException extends DomainException {
  constructor(userId: string) {
    super('USER_NOT_FOUND', `User ${userId} not found`, HttpStatus.NOT_FOUND);
  }
}
