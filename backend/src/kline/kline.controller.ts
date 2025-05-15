import { Controller, Get, Query } from '@nestjs/common';
import { KlineService } from './kline.service';
import { KLineData } from '@prisma/client';

@Controller('kline')
export class KlineController {
  constructor(private readonly klineService: KlineService) {}

  @Get()
  async getKlines(
    @Query('product') product?: string,
    @Query('isReal') isReal?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ): Promise<KLineData[]> {
    return this.klineService.getKlines(
      product,
      isReal ? isReal === 'true' : undefined,
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined,
    );
  }
}
