import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KlineService } from './kline.service';

interface KLineData {
  product: string;
  bar: string;
  isReal: boolean;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  createdAt: Date;
  updatedAt: Date;
  _id: string;
}

@Controller('kline')
export class KlineController {
  constructor(private readonly klineService: KlineService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 200 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadKlineFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('isReal') isReal: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      product: string;
      stats: { total: number; inserted: number; duplicates: number };
      timeRange: { start: string; end: string };
    };
  }> {
    const result = await this.klineService.processKlineFile(
      file,
      isReal === 'true',
    );
    console.log(result);
    return {
      success: true,
      message: '文件上传并处理成功',
      data: {
        product: result.product,
        stats: result.stats,
        timeRange: result.timeRange,
      },
    };
  }

  @Get()
  async getKlines(
    @Query('product') product?: string,
    @Query('isReal') isReal?: string,
    @Query('bar') bar?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ): Promise<KLineData[]> {
    return this.klineService.getKlines(
      product,
      isReal ? isReal === 'true' : undefined,
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined,
      bar
    );
  }

  @Get('products')
  async getAllProducts(): Promise<string[]> {
    return this.klineService.getAllProducts();
  }

  @Get('bars')
  async getAllBars(): Promise<string[]> {
    return this.klineService.getAllBars();
  }

  @Post('save-code')
  async saveCode(@Body() body: { code: string; name?: string; id?: string }) {
    if (body.id) {
      // 更新现有代码
      const updated = await this.klineService.renameCode(body.id, body.name || '');
      if (!updated) {
        throw new Error('更新失败');
      }
      return this.klineService.saveCode(body.code, body.name);
    } else {
      // 创建新代码
      return this.klineService.saveCode(body.code, body.name);
    }
  }

  @Post('rename-code')
  async renameCode(@Body() body: { id: string; newName: string }) {
    return this.klineService.renameCode(body.id, body.newName);
  }

  @Get('saved-codes')
  async getSavedCodes() {
    return this.klineService.getSavedCodes();
  }

  @Get('code/:id')
  async getCode(@Param('id') id: string) {
    return this.klineService.getCode(id);
  }

  @Post('delete-code')
  async deleteCode(@Body() body: { id: string }) {
    return this.klineService.deleteCode(body.id);
  }
}
