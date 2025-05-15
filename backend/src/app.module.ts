import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KlineModule } from './kline/kline.module';

@Module({
  imports: [KlineModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
