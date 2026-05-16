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

  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL'),
    credentials: true,
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
      timestamp: new Date().toISOString(),
    }),
  )
}

bootstrap()