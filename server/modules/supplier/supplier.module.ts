import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { SupplierController } from './supplier.controller.js';
import { SupplierService } from './supplier.service.js';

@Module({
  controllers: [SupplierController],
  providers: [DatabaseStorageService, SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
