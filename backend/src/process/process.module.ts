import { Module } from '@nestjs/common';
import { ProcessController } from './process.controller';
import { ProcessService } from './process.service';
import { TaskService } from 'src/task.service';

@Module({
  controllers: [ProcessController],
  // TODO  后续需要重构一下,为啥搞两个一个叫process 一个叫 task
  providers: [ProcessService , TaskService],
})
export class ProcessModule {}
