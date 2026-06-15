import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
    @Query('accountPeriodStart') accountPeriodStart = '',
    @Query('accountPeriodEnd') accountPeriodEnd = '',
  ) {
    return this.finance.invoices(Number(page), Number(pageSize), keyword, type, accountPeriodStart, accountPeriodEnd);
  }

  @Get('invoices/export')
  async exportInvoices(
    @Query('keyword') keyword = '',
    @Query('type') type = '',
    @Query('accountPeriodStart') accountPeriodStart = '',
    @Query('accountPeriodEnd') accountPeriodEnd = '',
    @Res() response: Response,
  ) {
    response.setHeader('Content-Disposition', 'attachment; filename=finance-invoices.xlsx');
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.finance.exportInvoices(keyword, type, accountPeriodStart, accountPeriodEnd));
  }
}
