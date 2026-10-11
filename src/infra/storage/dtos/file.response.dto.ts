import { BaseDto } from '@common/dtos/base.dto';

export class FileResponseDto extends BaseDto {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileExtension: string;
}

/** Internal row shape — carries the storage path; never serialized to a client. */
export class FileRecordDto {
  fileId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileExtension: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}
