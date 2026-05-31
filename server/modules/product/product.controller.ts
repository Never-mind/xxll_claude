import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { Product } from '../../../shared/api.interface.js';
import { ProductService } from './product.service.js';

@Controller('products')
export class ProductController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Get()
  list(@Query('keyword') keyword = '', @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.products.list(keyword, Number(page), Number(pageSize));
  }

  @Post()
  @UseGuards(WriteAuthGuard)
  create(@Body() body: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.products.create(body);
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  update(@Param('id') id: string, @Body() body: Partial<Product>) {
    return this.products.update(id, body);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Get('export')
  async export(@Res() response: Response) {
    response.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.products.export());
  }

  @Post('import')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: { buffer: Buffer }) {
    return this.products.import(file.buffer);
  }
}
