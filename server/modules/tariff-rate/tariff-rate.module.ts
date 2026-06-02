import { Module } from '@nestjs/common';
import { DatabaseStorageService } from '../../common/database-storage.service.js';
import { TariffRateController } from './tariff-rate.controller.js';
import { TariffRateService } from './tariff-rate.service.js';

@Module({
  controllers: [TariffRateController],
  providers: [DatabaseStorageService, TariffRateService],
  exports: [TariffRateService],
})
export class TariffRateModule {}
