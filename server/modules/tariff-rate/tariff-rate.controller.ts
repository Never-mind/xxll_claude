import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { TariffRate } from '../../../shared/api.interface.js';
import { TariffRateService } from './tariff-rate.service.js';

@Controller('tariff-rates')
export class TariffRateController {
  constructor(@Inject(TariffRateService) private readonly rates: TariffRateService) {}

  @Get()
  list(@Query('keyword') keyword = '', @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.rates.list(keyword, Number(page), Number(pageSize));
  }

  @Get('by-hs-code')
  byHsCode(@Query('hsCode') hsCode: string) {
    return this.rates.byHsCode(hsCode);
  }

  @Post()
  @UseGuards(WriteAuthGuard)
  create(@Body() body: Omit<TariffRate, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.rates.create(body);
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  update(@Param('id') id: string, @Body() body: Partial<TariffRate>) {
    return this.rates.update(id, body);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.rates.remove(id);
  }

  @Get('export')
  async export(@Res() response: Response) {
    response.setHeader('Content-Disposition', 'attachment; filename=tariff_rates.xlsx');
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.rates.export());
  }

  @Post('import')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: { buffer: Buffer }) {
    return this.rates.import(file.buffer);
  }
}
