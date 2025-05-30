import { Controller, Post, Body, Delete, Param, Get } from '@nestjs/common';
import { ProcessService } from './process.service';
import { CreateProcessDto } from './process.dto';

@Controller('process')
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  // @Post()
  // create(@Body() createProcessDto: CreateProcessDto) {
  //   return this.processService.create(createProcessDto);
  // }

  // @Delete(':id')
  // terminate(@Param('id') id: string) {
  //   return this.processService.terminate(id);
  // }

  // @Get()
  // list() {
  //   return this.processService.list();
  // }

  // @Get(':id/logs')
  // getLogs(@Param('id') id: string) {
  //   return this.processService.getLogs(id);
  // }

  @Get("initDataMontor")
  initDataMontor() {
    return this.processService.initDataMontor();
  }

  @Get("getAll")
  getAll() {
    return this.processService.getAll();
  }

  @Post("deploy")
  deploy(@Body() body: { id: string ,bars: string , instIds : string }) {
    return this.processService.deploy(body.id ,body.bars , body.instIds);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.processService.getStatus(id);
  }
}

// TODO 
// 后续可以加上rank模式