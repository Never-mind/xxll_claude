import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { CustomerController } from './customer.controller.js';
import { CustomerService } from './customer.service.js';

@Module({
  controllers: [CustomerController],
  providers: [DatabaseStorageService, CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
