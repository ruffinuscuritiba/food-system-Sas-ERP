import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response, NextFunction } from 'express'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  // Middleware agressivo para CORS - DEVE vir antes de qualquer outra coisa
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    // Permitir qualquer origem da Vercel ou localhost
    const isVercel = origin && origin.endsWith('.vercel.app');
    const isLocal = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));
    
    if (origin && (isVercel || isLocal)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    } else if (!origin) {
      // Para ferramentas como curl
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Cabeçalho de depuração para confirmar que este código está rodando
    res.setHeader('X-App-Version', '1.0.5-fixed-cors');

    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }

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

  // Desativar o enableCors padrão do NestJS para não haver conflito
  // app.enableCors() 

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
      version: '1.0.5-fixed-cors',
      port,
      timestamp: new Date().toISOString(),
    }),
  )
}

bootstrap()
