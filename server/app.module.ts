import { Module } from '@nestjs/common';
import { DatabaseStorageService } from './common/database-storage.service.js';
import { CustomerModule } from './modules/customer/customer.module.js';
import { HistoryQuotationModule } from './modules/history-quotation/history-quotation.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { QuotationModule } from './modules/quotation/quotation.module.js';
import { TariffRateModule } from './modules/tariff-rate/tariff-rate.module.js';

@Module({
  imports: [ProductModule, CustomerModule, TariffRateModule, HistoryQuotationModule, QuotationModule],
  providers: [DatabaseStorageService],
  exports: [DatabaseStorageService],
})
export class AppModule {}
