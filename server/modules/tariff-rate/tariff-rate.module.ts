import { Module } from '@nestjs/common';
import { ExcelStorageService } from '../../common/excel-storage.service.js';
import { TariffRateController } from './tariff-rate.controller.js';
import { TariffRateService } from './tariff-rate.service.js';

@Module({
  controllers: [TariffRateController],
  providers: [ExcelStorageService, TariffRateService],
  exports: [TariffRateService],
})
export class TariffRateModule {}
