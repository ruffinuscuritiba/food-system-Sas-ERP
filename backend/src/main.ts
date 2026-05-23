import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'
import cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  app.use(cors({
    origin: 'https://food-system-sas-erp-frontend.vercel.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new HttpExceptionFilter())
  app.setGlobalPrefix('api')

  const port = configService.get<number>('PORT') || 3001
  await app.listen(port)

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'app_started',
      version: '1.0.6-cors-fix',
      port,
      timestamp: new Date().toISOString(),
    }),
  )
}

bootstrap()
