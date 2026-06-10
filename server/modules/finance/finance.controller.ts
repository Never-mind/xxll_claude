import { Controller, Get, Inject, Query } from '@nestjs/common';
import { FinanceService } from './finance.service.js';

@Controller('finance')
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Get('invoices')
  invoices(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('keyword') keyword = '',
    @Query('type') type = '',
  ) {
    return this.finance.invoices(Number(page), Number(pageSize), keyword, type);
  }
}
