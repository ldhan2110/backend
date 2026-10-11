import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@common/exceptions/domain.exception';
import { FILE_DUPLICATE, FILE_NOT_FOUND } from '../constants/file.constants';

export class DuplicateFileException extends DomainException {
  constructor() {
    super(FILE_DUPLICATE, 'A file with identical content already exists', HttpStatus.CONFLICT);
  }
}

export class FileNotFoundException extends DomainException {
  constructor(fileId: string) {
    super(FILE_NOT_FOUND, `File ${fileId} not found`, HttpStatus.NOT_FOUND);
  }
}
