import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { CreateQuotationDto } from '../../../shared/api.interface.js';
import { QuotationService } from './quotation.service.js';

@Controller('quotations')
export class QuotationController {
  constructor(@Inject(QuotationService) private readonly quotations: QuotationService) {}

  @Post()
  @UseGuards(WriteAuthGuard)
  create(@Body() body: CreateQuotationDto) {
    return this.quotations.create(body);
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  update(@Param('id') id: string, @Body() body: CreateQuotationDto) {
    return this.quotations.update(id, body);
  }

  @Get()
  list(@Query('page') page = '1', @Query('pageSize') pageSize = '10', @Query('status') status?: string) {
    return this.quotations.list(Number(page), Number(pageSize), status);
  }

  @Get('export')
  async exportList(@Query('status') status: string | undefined, @Res() response: Response) {
    response.setHeader('Content-Disposition', 'attachment; filename=quotations.xlsx');
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.quotations.exportList(status));
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.quotations.detail(id);
  }

  @Get(':id/items')
  items(@Param('id') id: string, @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.quotations.items(id, Number(page), Number(pageSize));
  }

  @Get(':id/items-for-edit')
  itemsForEdit(@Param('id') id: string) {
    return this.quotations.itemsForEdit(id);
  }

  @Get(':id/export')
  async export(@Param('id') id: string, @Res() response: Response) {
    response.setHeader('Content-Disposition', `attachment; filename=quotation-${id}.xlsx`);
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.quotations.export(id));
  }

  @Get(':id/export-formal')
  async exportFormal(@Param('id') id: string, @Res() response: Response) {
    response.setHeader('Content-Disposition', `attachment; filename=formal-quotation-${id}.xlsx`);
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.quotations.exportFormalQuotation(id));
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.quotations.remove(id);
  }
}
