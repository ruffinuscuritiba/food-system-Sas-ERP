import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'
import { NestExpressApplication } from '@nestjs/platform-express'
import { PrismaService } from '@/database/prisma.service'
import { join } from 'path'
import { mkdirSync } from 'fs'
import type { Request, Response, NextFunction } from 'express'
import { json, urlencoded } from 'express'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Aumentar limite para suportar imagens base64 no body JSON (logo, banner, etc.)
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))

  // Serve uploaded files (fallback when Cloudinary is not configured)
  const uploadsDir = join(process.cwd(), 'uploads')
  try { mkdirSync(uploadsDir, { recursive: true }) } catch { /* ok */ }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' })
  const configService = app.get(ConfigService)

  // Configuração de CORS nativa do NestJS (recomendado)
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sem origin (curl, Render health checks, etc.)
      if (!origin) return callback(null, true);
      // Vercel (qualquer subdomínio) + localhost
      const allowed =
        /\.vercel\.app$/.test(origin) ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        origin === 'https://food-system-sas-erp-frontend.vercel.app';
      return callback(null, allowed ? origin : false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      return res.status(200).json({
        status: 'ok',
        service: 'food-system-backend',
        api: '/api',
        timestamp: new Date().toISOString(),
      })
    }
    return next()
  })

  // Readiness gate: hold requests until Prisma is connected.
  // Returns 503 immediately if not ready (frontend interceptor retries 5xx).
  const prismaService = app.get(PrismaService)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/health') return next()
    if (prismaService.isReady) return next()
    res.status(503).json({ message: 'Service starting, please retry in a few seconds' })
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
      version: '1.0.7-nest-cors',
      port,
      timestamp: new Date().toISOString(),
    }),
  )
}

bootstrap()
