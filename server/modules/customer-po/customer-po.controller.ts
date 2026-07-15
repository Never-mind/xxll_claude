import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { CreateCustomerPoDto } from '../../../shared/api.interface.js';
import { CustomerPoService } from './customer-po.service.js';

@Controller('customer-pos')
export class CustomerPoController {
  constructor(@Inject(CustomerPoService) private readonly customerPos: CustomerPoService) {}

  @Get()
  list(@Query('keyword') keyword = '', @Query('status') status = 'all', @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.customerPos.list(keyword, status, Number(page), Number(pageSize));
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.customerPos.detail(id);
  }

  @Post()
  @UseGuards(WriteAuthGuard)
  create(@Body() body: CreateCustomerPoDto) {
    return this.customerPos.save(body);
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  update(@Param('id') id: string, @Body() body: CreateCustomerPoDto) {
    return this.customerPos.save(body, id);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.customerPos.remove(id);
  }

  @Post(':id/generate-quotation')
  @UseGuards(WriteAuthGuard)
  async generateQuotation(@Param('id') id: string) {
    try {
      return await this.customerPos.generateQuotation(id);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
