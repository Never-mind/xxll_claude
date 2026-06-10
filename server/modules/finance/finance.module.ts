import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';

@Module({
  controllers: [FinanceController],
  providers: [DatabaseStorageService, FinanceService],
})
export class FinanceModule {}
