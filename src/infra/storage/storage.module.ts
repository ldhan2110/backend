import { Module } from '@nestjs/common';
import { StorageController } from './controllers/storage.controller';
import { StorageRepository } from './repository/storage.repository';
import { StorageService } from './services/storage.service';

@Module({
  controllers: [StorageController],
  providers: [StorageService, StorageRepository],
  exports: [StorageService],
})
export class StorageModule {}
