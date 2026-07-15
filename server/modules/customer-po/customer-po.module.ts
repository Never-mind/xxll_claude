import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { CustomerModule } from '../customer/customer.module.js';
import { ProductModule } from '../product/product.module.js';
import { QuotationModule } from '../quotation/quotation.module.js';
import { CustomerPoController } from './customer-po.controller.js';
import { CustomerPoService } from './customer-po.service.js';

@Module({
  imports: [CustomerModule, ProductModule, QuotationModule],
  controllers: [CustomerPoController],
  providers: [CustomerPoService, DatabaseStorageService],
  exports: [CustomerPoService],
})
export class CustomerPoModule {}
