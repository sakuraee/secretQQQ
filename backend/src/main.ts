import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TaskService } from './task.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend development server
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Accept',
    credentials: true
  });

  // Initialize database on startup
  const taskService = app.get(TaskService);
  //await taskService.initDatabase();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
