import { Injectable } from '@nestjs/common';
import { fork, ChildProcess } from 'child_process';
import { CreateProcessDto } from './process.dto';

@Injectable()
export class ProcessService {
  private processes: Map<string, ChildProcess> = new Map();

  create(name: string, func: string, interval: number = 5000) {
    const process = fork('../backend/src/process/child/datamonitor.js');
    this.processes.set(name, process);
    // 发送函数和间隔时间
    process.send({
      funcStr: "console.log('hello world213123123')",
      interval,
    });

    // 接收子进程消息
    process.on('message', (msg: any) => {
      if (msg.type === 'output') {
        console.log('子进程输出:', msg.data);
      }
    });

    process.on('exit', () => {
      console.log(2224);
      this.processes.delete(name);
    });
  }

  // terminate(id: string) {
  //   const process = this.processes.get(id);
  //   if (!process) {
  //     throw new Error(`Process ${id} not found`);
  //   }
  //   process.child.kill();
  //   process.status = 'terminated';
  //   return { success: true };
  // }

  // list() {
  //   return Array.from(this.processes.values()).map(
  //     ({ id, command, args, status, startTime }) => ({
  //       id,
  //       command,
  //       args,
  //       status,
  //       startTime,
  //     }),
  //   );
  // }

  // getLogs(id: string) {
  //   const process = this.processes.get(id);
  //   if (!process) {
  //     throw new Error(`Process ${id} not found`);
  //   }
  //   return process.logs;
  // }

  getStatus(name: string) {
    const process = this.processes.get(name);
    if (!process) {
      return { status: 'not-running' };
    }
    return { status: 'running' };
  }
}
