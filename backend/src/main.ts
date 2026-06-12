import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '@/database/prisma.service';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // rawBody necessário para validação HMAC de webhooks (iFood, etc.)
  app.use(
    json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Serve uploaded files (fallback when Cloudinary is not configured)
  const uploadsDir = join(process.cwd(), 'uploads');
  try {
    mkdirSync(uploadsDir, { recursive: true });
  } catch {
    /* ok */
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
  const configService = app.get(ConfigService);

  // Configuração de CORS nativa do NestJS (recomendado)
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sem origin (curl, probes de saúde, etc.)
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

  const prismaService = app.get(PrismaService);

  app.use((req: Request, res: Response, next: NextFunction) => {
    // Root probe (VPS TCP health + keepalive ping)
    if (req.path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      return res.status(200).json({
        status: 'ok',
        service: 'food-system-backend',
        api: '/api',
        timestamp: new Date().toISOString(),
      });
    }
    // Health endpoint: 200 quando pronto, 503 durante cold start
    if (
      req.path === '/api/health' &&
      (req.method === 'GET' || req.method === 'HEAD')
    ) {
      return res.status(prismaService.isReady ? 200 : 503).json({
        status: prismaService.isReady ? 'ok' : 'starting',
        ready: prismaService.isReady,
        timestamp: new Date().toISOString(),
      });
    }
    return next();
  });

  // Readiness gate: segura requests de negócio até Prisma conectar
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (prismaService.isReady) return next();
    res
      .status(503)
      .json({ message: 'Service starting, please retry in a few seconds' });
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);

  // ── Validação de variáveis de ambiente críticas ──
  const dbUrl     = configService.get<string>('DATABASE_URL') || '';
  const jwtSecret = configService.get<string>('JWT_SECRET')   || '';
  const backendUrl= configService.get<string>('BACKEND_URL')  || '';

  if (!dbUrl)
    console.warn(JSON.stringify({ level: 'warn', event: 'env_missing', key: 'DATABASE_URL', timestamp: new Date().toISOString() }));
  else if (dbUrl.includes('onrender.com') || dbUrl.includes('supabase.co'))
    console.warn(JSON.stringify({ level: 'warn', event: 'env_stale_db', msg: 'DATABASE_URL aponta para serviço externo gerenciado — confirme se é intencional', timestamp: new Date().toISOString() }));

  if (!jwtSecret)
    console.warn(JSON.stringify({ level: 'warn', event: 'env_missing', key: 'JWT_SECRET', msg: 'JWT_SECRET não definido — tokens não serão validados corretamente', timestamp: new Date().toISOString() }));

  if (!backendUrl)
    console.warn(JSON.stringify({ level: 'warn', event: 'env_missing', key: 'BACKEND_URL', msg: 'BACKEND_URL não definido — webhooks e links públicos podem estar quebrados', timestamp: new Date().toISOString() }));

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'app_started',
      version: '1.0.8-vps',
      port,
      backendUrl: backendUrl || '(não definido)',
      dbHost: dbUrl ? new URL(dbUrl).hostname : '(não definido)',
      timestamp: new Date().toISOString(),
    }),
  );
}

bootstrap();
