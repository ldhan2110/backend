import { Injectable } from '@nestjs/common';
import { SqlMapper } from '@infra/database/mapper';
import { FileRecordDto } from '../dtos/file.response.dto';

export interface NewFileRecord {
  fileId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileExtension: string;
}

@Injectable()
export class StorageRepository {
  constructor(private readonly mapper: SqlMapper) {}

  findById(fileId: string): Promise<FileRecordDto | null> {
    return this.mapper.selectOne(FileRecordDto, this.mapper.named('file.findById'), { fileId });
  }

  findByPath(filePath: string): Promise<FileRecordDto | null> {
    return this.mapper.selectOne(FileRecordDto, this.mapper.named('file.findByPath'), { filePath });
  }

  insert(record: NewFileRecord, by: string): Promise<number> {
    return this.mapper.insert(this.mapper.named('file.insert'), { ...record, by });
  }
}
