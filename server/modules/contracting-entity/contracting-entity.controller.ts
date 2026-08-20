import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WriteAuthGuard } from '../../common/write-auth.guard.js';
import type { CreateContractingEntityDto, UpdateContractingEntityDto } from '../../../shared/api.interface.js';
import { ContractingEntityService } from './contracting-entity.service.js';

@Controller('contracting-entities')
export class ContractingEntityController {
  constructor(@Inject(ContractingEntityService) private readonly entities: ContractingEntityService) {}

  @Get()
  list(@Query('keyword') keyword = '', @Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    return this.entities.list(keyword, Number(page), Number(pageSize));
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Res() response: Response) {
    const attachment = await this.entities.findAttachment(id, attachmentId);
    const { mimeType, buffer } = decodeDataUrl(attachment.dataUrl || '');
    response.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(attachment.fileName.replace(/[\r\n"]/g, '_'))}`);
    response.type(attachment.fileType || mimeType || 'application/octet-stream');
    response.send(buffer);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.entities.detail(id);
  }

  @Post()
  @UseGuards(WriteAuthGuard)
  async create(@Body() body: CreateContractingEntityDto) {
    try {
      return await this.entities.create(body);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  @Put(':id')
  @UseGuards(WriteAuthGuard)
  async update(@Param('id') id: string, @Body() body: UpdateContractingEntityDto) {
    try {
      return await this.entities.update(id, body);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  @Post(':id/attachments')
  @UseGuards(WriteAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  addAttachment(@Param('id') id: string, @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    if (!file) throw new BadRequestException('Attachment file is required');
    return this.entities.addAttachment(id, {
      fileName: normalizeUploadedFileName(file.originalname),
      fileType: file.mimetype || '',
      fileSize: file.size,
      dataUrl: `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`,
    });
  }

  @Delete(':id/attachments/:attachmentId')
  @UseGuards(WriteAuthGuard)
  deleteAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.entities.deleteAttachment(id, attachmentId);
  }

  @Delete(':id')
  @UseGuards(WriteAuthGuard)
  async remove(@Param('id') id: string) {
    try {
      return await this.entities.remove(id);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

function decodeDataUrl(value: string): { mimeType: string; buffer: Buffer } {
  const match = value.match(/^data:([^;,]+)?;base64,(.*)$/s);
  return match ? { mimeType: match[1] || '', buffer: Buffer.from(match[2], 'base64') } : { mimeType: '', buffer: Buffer.from(value) };
}

function normalizeUploadedFileName(fileName: string): string {
  if (!fileName || !/[\u0080-\u00ff]/.test(fileName)) return fileName;
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? fileName : decoded;
}
