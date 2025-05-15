import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KLineData } from '@prisma/client';

@Injectable()
export class KlineService {
  constructor(private prisma: PrismaService) {}

  async getKlines(
    product?: string,
    isReal?: boolean,
    startTime?: Date,
    endTime?: Date,
  ): Promise<KLineData[]> {
    return this.prisma.kLineData.findMany({
      where: {
        product: product ? { equals: product } : undefined,
        isReal: isReal !== undefined ? { equals: isReal } : undefined,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async createKline(data: {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    product: string;
    isReal: boolean;
  }): Promise<KLineData> {
    return this.prisma.kLineData.create({
      data,
    });
  }
}
