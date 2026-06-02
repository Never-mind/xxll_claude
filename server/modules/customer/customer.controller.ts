import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { Customer } from '../../../shared/api.interface.js';
import { CustomerService } from './customer.service.js';

@Controller('customers')
export class CustomerController {
  constructor(@Inject(CustomerService) private readonly customers: CustomerService) {}

  @Get()
  list(@Query('keyword') keyword = '', @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.customers.list(keyword, Number(page), Number(pageSize));
  }

  @Post()
  @UseGuards(WriteAuthGuard)
  create(@Body() body: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.customers.create(body);
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  update(@Param('id') id: string, @Body() body: Partial<Customer>) {
    return this.customers.update(id, body);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }

  @Get('export')
  async export(@Res() response: Response) {
    response.setHeader('Content-Disposition', 'attachment; filename=customers.xlsx');
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.customers.export());
  }

  @Post('import')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: { buffer: Buffer }) {
    return this.customers.import(file.buffer);
  }
}
