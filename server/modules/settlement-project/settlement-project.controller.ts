import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type {
  CreateSettlementAttachmentDto,
  CreateSettlementExpenseDto,
  CreateSettlementInvoiceDto,
  CreateSettlementSaleDto,
  SettlementOrderDto,
  UpdateSettlementItemDto,
  UpdateSettlementExpenseDto,
  UpdateSettlementInvoiceDto,
  UpdateSettlementSaleDto,
} from '../../../shared/api.interface.js';
import { SettlementProjectService } from './settlement-project.service.js';

@Controller('settlement-projects')
export class SettlementProjectController {
  constructor(@Inject(SettlementProjectService) private readonly settlements: SettlementProjectService) {}

  @Get()
  list(@Query('page') page = '1', @Query('pageSize') pageSize = '10', @Query('keyword') keyword = '') {
    return this.settlements.list(Number(page), Number(pageSize), keyword);
  }

  @Get('export')
  async exportList(@Res() response: Response) {
    response.setHeader('Content-Disposition', 'attachment; filename=settlement-projects.xlsx');
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.settlements.exportList());
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.settlements.detail(id);
  }

  @Get(':id/export')
  async export(@Param('id') id: string, @Res() response: Response) {
    response.setHeader('Content-Disposition', `attachment; filename=settlement-project-${id}.xlsx`);
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.settlements.export(id));
  }

  @Post(':id/order')
  @UseGuards(WriteAuthGuard)
  order(@Param('id') id: string, @Body() body: SettlementOrderDto) {
    return this.settlements.orderItems(id, body);
  }

  @Post(':id/expenses')
  @UseGuards(WriteAuthGuard)
  addExpense(@Param('id') id: string, @Body() body: CreateSettlementExpenseDto) {
    return this.settlements.addExpense(id, body);
  }

  @Put(':id/expenses/:expenseId')
  @UseGuards(WriteAuthGuard)
  updateExpense(@Param('id') id: string, @Param('expenseId') expenseId: string, @Body() body: UpdateSettlementExpenseDto) {
    return this.settlements.updateExpense(id, expenseId, body);
  }

  @Delete(':id/expenses/:expenseId')
  @UseGuards(WriteAuthGuard)
  deleteExpense(@Param('id') id: string, @Param('expenseId') expenseId: string) {
    return this.settlements.deleteExpense(id, expenseId);
  }

  @Post(':id/sales')
  @UseGuards(WriteAuthGuard)
  addSale(@Param('id') id: string, @Body() body: CreateSettlementSaleDto) {
    return this.settlements.addSale(id, body);
  }

  @Put(':id/sales/:saleId')
  @UseGuards(WriteAuthGuard)
  updateSale(@Param('id') id: string, @Param('saleId') saleId: string, @Body() body: UpdateSettlementSaleDto) {
    return this.settlements.updateSale(id, saleId, body);
  }

  @Delete(':id/sales/:saleId')
  @UseGuards(WriteAuthGuard)
  deleteSale(@Param('id') id: string, @Param('saleId') saleId: string) {
    return this.settlements.deleteSale(id, saleId);
  }

  @Post(':id/invoices')
  @UseGuards(WriteAuthGuard)
  addInvoice(@Param('id') id: string, @Body() body: CreateSettlementInvoiceDto) {
    return this.settlements.addInvoice(id, body);
  }

  @Put(':id/invoices/:invoiceId')
  @UseGuards(WriteAuthGuard)
  updateInvoice(@Param('id') id: string, @Param('invoiceId') invoiceId: string, @Body() body: UpdateSettlementInvoiceDto) {
    return this.settlements.updateInvoice(id, invoiceId, body);
  }

  @Delete(':id/invoices/:invoiceId')
  @UseGuards(WriteAuthGuard)
  deleteInvoice(@Param('id') id: string, @Param('invoiceId') invoiceId: string) {
    return this.settlements.deleteInvoice(id, invoiceId);
  }

  @Delete(':id/items/:itemId/order')
  @UseGuards(WriteAuthGuard)
  returnPurchasedItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.settlements.returnPurchasedItem(id, itemId);
  }

  @Put(':id/items/:itemId')
  @UseGuards(WriteAuthGuard)
  updatePurchasedItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: UpdateSettlementItemDto) {
    return this.settlements.updatePurchasedItem(id, itemId, body);
  }

  @Post(':id/attachments')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    @Body('description') description = '',
  ) {
    if (!file) throw new Error('Attachment file is required');
    const dataUrl = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
    return this.settlements.addAttachment(id, {
      fileName: file.originalname,
      fileType: file.mimetype || '',
      fileSize: file.size,
      dataUrl,
      description,
    });
  }

  @Post(':id/complete')
  @UseGuards(WriteAuthGuard)
  complete(@Param('id') id: string) {
    return this.settlements.complete(id);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.settlements.remove(id);
  }
}
