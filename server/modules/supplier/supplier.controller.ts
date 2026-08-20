import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { CreateSupplierDto, UpdateSupplierDto } from '../../../shared/api.interface.js';
import { SupplierService } from './supplier.service.js';

@Controller('suppliers')
export class SupplierController {
  constructor(@Inject(SupplierService) private readonly suppliers: SupplierService) {}

  @Get()
  list(@Query('keyword') keyword = '', @Query('status') status = '', @Query('type') type = '', @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.suppliers.list(keyword, status, type, Number(page), Number(pageSize));
  }

  @Get('export')
  async export(@Res() response: Response) {
    response.setHeader('Content-Disposition', 'attachment; filename=suppliers.xlsx');
    response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.send(await this.suppliers.export());
  }

  @Post('import')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  import(@UploadedFile() file: { buffer: Buffer }) {
    if (!file) throw new Error('Supplier import file is required');
    return this.suppliers.import(file.buffer);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Res() response: Response) {
    const attachment = await this.suppliers.findAttachment(id, attachmentId);
    const { mimeType, buffer } = decodeDataUrl(attachment.dataUrl || '');
    response.setHeader('Content-Disposition', contentDisposition(attachment.fileName));
    response.type(attachment.fileType || mimeType || 'application/octet-stream');
    response.send(buffer);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.suppliers.detail(id);
  }

  @Post()
  @UseGuards(WriteAuthGuard)
  create(@Body() body: CreateSupplierDto) {
    return this.suppliers.create(body);
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  update(@Param('id') id: string, @Body() body: UpdateSupplierDto) {
    return this.suppliers.update(id, body);
  }

  @Post(':id/attachments')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) throw new Error('Attachment file is required');
    return this.suppliers.addAttachment(id, {
      fileName: normalizeUploadedFileName(file.originalname),
      fileType: file.mimetype || '',
      fileSize: file.size,
      dataUrl: `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`,
    });
  }

  @Delete(':id/attachments/:attachmentId')
  @UseGuards(WriteAuthGuard)
  deleteAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.suppliers.deleteAttachment(id, attachmentId);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  remove(@Param('id') id: string) {
    return this.suppliers.remove(id);
  }
}

function decodeDataUrl(value: string): { mimeType: string; buffer: Buffer } {
  const match = value.match(/^data:([^;,]+)?;base64,(.*)$/s);
  if (!match) return { mimeType: '', buffer: Buffer.from(value) };
  return { mimeType: match[1] || '', buffer: Buffer.from(match[2], 'base64') };
}

function contentDisposition(fileName: string): string {
  const safeName = fileName.replace(/[\r\n"]/g, '_');
  return `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

function normalizeUploadedFileName(fileName: string): string {
  if (!fileName || !/[\u0080-\u00ff]/.test(fileName)) return fileName;
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? fileName : decoded;
}
