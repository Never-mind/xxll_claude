import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { CustomerModule } from '../customer/customer.module.js';
import { HistoryQuotationModule } from '../history-quotation/history-quotation.module.js';
import { ProductModule } from '../product/product.module.js';
import { TariffRateModule } from '../tariff-rate/tariff-rate.module.js';
import { QuotationController } from './quotation.controller.js';
import { QuotationService } from './quotation.service.js';

@Module({
  imports: [ProductModule, CustomerModule, TariffRateModule, HistoryQuotationModule],
  controllers: [QuotationController],
  providers: [DatabaseStorageService, QuotationService],
})
export class QuotationModule {}
