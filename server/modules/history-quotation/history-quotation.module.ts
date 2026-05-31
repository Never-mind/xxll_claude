import { Module } from '@nestjs/common';
import { ExcelStorageService } from '../../common/excel-storage.service.js';
import { ProductModule } from '../product/product.module.js';
import { HistoryQuotationController } from './history-quotation.controller.js';
import { HistoryQuotationService } from './history-quotation.service.js';

@Module({
  imports: [ProductModule],
  controllers: [HistoryQuotationController],
  providers: [ExcelStorageService, HistoryQuotationService],
  exports: [HistoryQuotationService],
})
export class HistoryQuotationModule {}
