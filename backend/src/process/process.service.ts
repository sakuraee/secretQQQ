import { Injectable } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { CreateProcessDto } from './process.dto';
import { ProcessInfo } from './process.interface';

@Injectable()
export class ProcessService {
  private processes: Map<string, ProcessInfo> = new Map();

  async create(createProcessDto: CreateProcessDto) {
    const {
      command,
      args = [],
      options = {},
      id = Date.now().toString(),
    } = createProcessDto;
    const child = spawn(command, args, options);

    return new Promise((resolve, reject) => {
      const logs: string[] = [];

      child.stdout?.on('data', (data) => {
        console.log(data.toString());
        logs.push(data.toString());
      });

      child.stderr?.on('data', (data) => {
        logs.push(data.toString());
      });

      const processInfo: ProcessInfo = {
        id,
        child,
        command,
        args,
        logs,
        status: 'running',
        startTime: new Date(),
      };

      this.processes.set(id, processInfo);

      child.on('close', () => {
        const process = this.processes.get(id);
        if (process) {
          process.status = 'exited';
        }
      });

      child.on('spawn', () => {
        resolve({ id });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  terminate(id: string) {
    const process = this.processes.get(id);
    if (!process) {
      throw new Error(`Process ${id} not found`);
    }
    process.child.kill();
    process.status = 'terminated';
    return { success: true };
  }

  list() {
    return Array.from(this.processes.values()).map(
      ({ id, command, args, status, startTime }) => ({
        id,
        command,
        args,
        status,
        startTime,
      }),
    );
  }

  getLogs(id: string) {
    const process = this.processes.get(id);
    if (!process) {
      throw new Error(`Process ${id} not found`);
    }
    return process.logs;
  }

  getStatus(id: string) {
    const process = this.processes.get(id);
    if (!process) {
      return { status: 'not-running' };
    }
    return { status: process.status };
  }
}
