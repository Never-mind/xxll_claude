import { Module } from '@nestjs/common';
import { ExcelStorageService } from '../../common/excel-storage.service.js';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';

@Module({
  controllers: [ProductController],
  providers: [ExcelStorageService, ProductService],
  exports: [ProductService],
})
export class ProductModule {}
