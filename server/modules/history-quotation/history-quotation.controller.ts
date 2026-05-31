import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { HistoryQuotation } from '../../../shared/api.interface.js';
import { HistoryQuotationService } from './history-quotation.service.js';

@Controller('history-quotations')
export class HistoryQuotationController {
  constructor(@Inject(HistoryQuotationService) private readonly history: HistoryQuotationService) {}

  @Get()
  list(@Query('keyword') keyword = '', @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.history.list(keyword, Number(page), Number(pageSize));
  }

  @Post()
  @UseGuards(WriteAuthGuard)
  create(@Body() body: Omit<HistoryQuotation, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.history.create(body);
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  update(@Param('id') id: string, @Body() body: Partial<HistoryQuotation>) {
    return this.history.update(id, body);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.history.remove(id);
  }

  @Get('export')
  async export(@Res() response: Response) {
    response.setHeader('Content-Disposition', 'attachment; filename=history_quotations.xlsx');
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.history.export());
  }

  @Post('import')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: { buffer: Buffer }) {
    return this.history.import(file.buffer);
  }
}
