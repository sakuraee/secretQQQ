import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProcessModule } from './process/process.module';
import { KlineModule } from './kline/kline.module';
import { TaskService } from './task.service';

@Module({
  imports: [ProcessModule, KlineModule],
  controllers: [AppController],
  providers: [AppService, TaskService],
})
export class AppModule {}
