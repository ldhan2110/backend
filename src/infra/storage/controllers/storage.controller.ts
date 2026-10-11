import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { DISPOSITION_ATTACHMENT } from '../constants/file.constants';
import { StorageService } from '../services/storage.service';

@Controller({ path: 'files', version: '1' })
export class StorageController {
  constructor(private readonly service: StorageService) {}

  @Get(':id')
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { record, stream } = await this.service.download(id);
    res.set({
      'Content-Disposition': `${DISPOSITION_ATTACHMENT}; filename="${record.fileName}"`,
    });
    return new StreamableFile(stream);
  }
}
