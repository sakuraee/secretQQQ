import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KlineModule } from './kline/kline.module';
import { TaskService } from './task.service';

@Module({
  imports: [KlineModule],
  controllers: [AppController],
  providers: [AppService, TaskService],
})
export class AppModule {}
