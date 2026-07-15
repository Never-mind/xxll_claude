import { Module } from '@nestjs/common';
import { DatabaseStorageService } from './common/database-storage.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomerModule } from './modules/customer/customer.module.js';
import { CustomerPoModule } from './modules/customer-po/customer-po.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { HistoryQuotationModule } from './modules/history-quotation/history-quotation.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { QuotationModule } from './modules/quotation/quotation.module.js';
import { SettlementProjectModule } from './modules/settlement-project/settlement-project.module.js';
import { TariffRateModule } from './modules/tariff-rate/tariff-rate.module.js';

@Module({
  imports: [AuthModule, ProductModule, CustomerModule, CustomerPoModule, TariffRateModule, HistoryQuotationModule, SettlementProjectModule, QuotationModule, FinanceModule],
  providers: [DatabaseStorageService],
  exports: [DatabaseStorageService],
})
export class AppModule {}
