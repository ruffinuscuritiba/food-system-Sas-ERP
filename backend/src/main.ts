import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response, NextFunction } from 'express'

import { AppModule } from './app.module'

import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const configService = app.get(ConfigService)

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now()

    res.on('finish', () => {
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'http_request',
          method: req.method,
          path: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
          timestamp: new Date().toISOString(),
        }),
      )
    })

    next()
  })

  // CORS Configuration
  const corsOrigins = [
    'https://food-system-sas-erp.vercel.app',
    'https://food-system-sas-qibvc3cet-ruffinuscuritiba.vercel.app',
    /^https:\/\/.*\.vercel\.app$/,
    'http://localhost:3000',
    'http://localhost:3001',
    configService.get<string>('FRONTEND_URL'),
  ].filter(Boolean)

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  })

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
      port,
      corsOrigins: corsOrigins.map((o) => (typeof o === 'string' ? o : o.toString())),
      timestamp: new Date().toISOString(),
    }),
  )
}

bootstrap()