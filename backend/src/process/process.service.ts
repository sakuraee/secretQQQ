import { Injectable } from '@nestjs/common';
import { fork, ChildProcess } from 'child_process';
import { CreateProcessDto } from './process.dto';
import { Db, MongoClient, ObjectId } from 'mongodb';

const DB_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017';
const DB_NAME = 'crypto_web';

@Injectable()
export class ProcessService {
  private db: Db;
  private processes: Map<string, ChildProcess> = new Map();

  constructor() {
      const client = new MongoClient(DB_URL);
      this.db = client.db(DB_NAME);
  }

  create(codeName:string ,bars: string | any , instIds :string ) {
    const processName = `${codeName}-${bars}-${instIds}`
    if(this.processes.has(processName)) {
      throw new Error(`Process ${processName} already exists`);
    }

    const process = fork('../backend/src/process/child/trader.js');
    this.processes.set(processName, process);
    // 发送函数和间隔时间
    process.send({
      codeName,
      instIds,
      bars
    });

    // 接收子进程消息
    process.on('message', (msg: any) => {
      if (msg.type === 'output') {
        console.log(`${codeName} 子进程输出:`, msg.data);
      }
    });

    process.on('exit', () => {
      console.log(`${codeName} 子进程中止:` );
      this.processes.delete(codeName);
    });
  }

  async initDataMontor() {
    if (this.processes.has("data-monitor")) {
      return;
    }
    const process = fork('../backend/src/process/child/datamonitor.js');
    this.processes.set("data-monitor", process);

    // 接收子进程消息
    process.on('message', (msg: any) => {
      if (msg.type === 'output') {
        console.log('data-monitor 输出:', msg.data);
        // 在这里应该加上如果说有当前的信息应该同步给每一个剩余的子进程,回去写一下吧
      }

      if (msg.type === 'result') {
        for(let key of this.processes.keys()){
          const process = this.processes.get(key)
          process?.send({"currentData":msg.data})
        }
        // 在这里应该加上如果说有当前的信息应该同步给每一个剩余的子进程,回去写一下吧
      }

    });

    process.on('exit', () => {
      console.log(2224);
      this.processes.delete("data-monitor");
    });
  }
  
  getAll(){
    return Array.from(this.processes.keys())
  }

  async deploy(codeId:string ,bars: string | any , instIds :string ){
    console.log(codeId,bars,instIds)

    const cursor = await this.db.collection("SavedCodes").findOne({_id: new ObjectId(codeId)})
    let codeName = ""
    if(!cursor) return 
    codeName = cursor.name
    if(codeName.length == 0 || (!codeName)){
      return 
    }
    await this.create(codeName,bars,instIds)
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
