import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { ProductModule } from '../product/product.module.js';
import { HistoryQuotationController } from './history-quotation.controller.js';
import { HistoryQuotationService } from './history-quotation.service.js';

@Module({
  imports: [ProductModule],
  controllers: [HistoryQuotationController],
  providers: [DatabaseStorageService, HistoryQuotationService],
  exports: [HistoryQuotationService],
})
export class HistoryQuotationModule {}
