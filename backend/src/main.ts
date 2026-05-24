import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { mkdirSync } from 'fs'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

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
