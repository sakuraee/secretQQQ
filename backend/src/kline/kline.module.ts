import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { KlineService } from './kline.service';
import { KlineController } from './kline.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      limits: {
        fileSize: 1024 * 1024 * 10, // 10MB
      },
    }),
  ],
  controllers: [KlineController],
  providers: [KlineService],
  exports: [KlineService],
})
export class KlineModule {}
