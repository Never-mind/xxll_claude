import { Module } from '@nestjs/common';
import { ExcelStorageService } from '../../common/excel-storage.service.js';
import { HistoryQuotationModule } from '../history-quotation/history-quotation.module.js';
import { ProductModule } from '../product/product.module.js';
import { TariffRateModule } from '../tariff-rate/tariff-rate.module.js';
import { QuotationController } from './quotation.controller.js';
import { QuotationService } from './quotation.service.js';

@Module({
  imports: [ProductModule, TariffRateModule, HistoryQuotationModule],
  controllers: [QuotationController],
  providers: [ExcelStorageService, QuotationService],
})
export class QuotationModule {}
