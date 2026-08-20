import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { ContractingEntityController } from './contracting-entity.controller.js';
import { ContractingEntityService } from './contracting-entity.service.js';

@Module({
  controllers: [ContractingEntityController],
  providers: [DatabaseStorageService, ContractingEntityService],
  exports: [ContractingEntityService],
})
export class ContractingEntityModule {}
