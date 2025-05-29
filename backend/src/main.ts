import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TaskService } from './task.service';
import { ProcessService } from './process/process.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend development server
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Accept',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
// 后面就是完整的部署了，怎么启动一个新的进程，怎么停止它，怎么一直获取数据，怎么监控并且发送邮件
bootstrap();
