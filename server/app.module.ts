import { Module } from '@nestjs/common';
import { ExcelStorageService } from './common/excel-storage.service.js';
import { HistoryQuotationModule } from './modules/history-quotation/history-quotation.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { QuotationModule } from './modules/quotation/quotation.module.js';
import { TariffRateModule } from './modules/tariff-rate/tariff-rate.module.js';

@Module({
  imports: [ProductModule, TariffRateModule, HistoryQuotationModule, QuotationModule],
  providers: [ExcelStorageService],
  exports: [ExcelStorageService],
})
export class AppModule {}
