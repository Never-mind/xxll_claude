import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { SettlementProjectController } from './settlement-project.controller.js';
import { SettlementProjectService } from './settlement-project.service.js';

@Module({
  controllers: [SettlementProjectController],
  providers: [DatabaseStorageService, SettlementProjectService],
  exports: [SettlementProjectService],
})
export class SettlementProjectModule {}
