import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { TariffRateModule } from '../tariff-rate/tariff-rate.module.js';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';

@Module({
  imports: [TariffRateModule],
  controllers: [ProductController],
  providers: [DatabaseStorageService, ProductService],
  exports: [ProductService],
})
export class ProductModule {}
