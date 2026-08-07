import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Patch,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import type { Response } from 'express';

import { ConfigService } from '@nestjs/config';

import { FileInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import { ProductsService } from './products.service';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { RolesGuard } from '@/common/guards/roles.guard';

import { Roles } from '@/common/decorators/roles.decorator';

import { CreateProductDto } from './dto/create-product.dto';

import { Throttle } from '@nestjs/throttler';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly service: ProductsService,

    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async create(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateProductDto,
  ) {
    let imageUrl: string | null = body.imageUrl || null;

    if (file) {
      imageUrl = await this.resolveImageUrl(file);
    }

    // companyId always from JWT — never trust the body
    return this.service.create({
      ...body,
      imageUrl,
      companyId: req.user.companyId,
    });
  }

  // IMPORTANTE: rota literal "reorder" precisa ficar ANTES de "@Patch(':id')" para não casar como id.
  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  reorder(
    @Body() body: { items: { id: string; sortOrder: number }[] },
    @Request() req: any,
  ) {
    return this.service.reorder(req.user.companyId, body?.items ?? []);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Request() req: any,
  ) {
    let imageUrl: string | undefined = body.imageUrl;

    if (file) {
      imageUrl = await this.resolveImageUrl(file);
    }

    return this.service.update(id, {
      ...body,
      companyId: req.user.companyId,
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    });
  }

  /**
   * Convert a multer file to a persistent URL.
   * Priority: Cloudinary → base64 data URL (stored in DB, zero infra needed).
   * Local-disk fallback removed: Render's filesystem is ephemeral.
   */
  private async resolveImageUrl(file: Express.Multer.File): Promise<string> {
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');

    if (cloudinaryUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({ cloudinary_url: cloudinaryUrl });
        const result = await new Promise<any>((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { Readable } = require('stream');
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'food-system', resource_type: 'image' },
            (error: any, res: any) => {
              if (error) reject(error);
              else resolve(res);
            },
          );
          Readable.from(file.buffer).pipe(stream);
        });
        return result.secure_url;
      } catch {
        // fall through to base64
      }
    }

    // Fallback: base64 data URL — permanent (stored in DB), no external service needed
    const mime = file.mimetype?.startsWith('image/')
      ? file.mimetype
      : 'image/jpeg';
    return `data:${mime};base64,${file.buffer.toString('base64')}`;
  }

  @Get('public/menu/:companyId')
  publicMenu(
    @Param('companyId')
    companyId: string,
  ) {
    return this.service.publicMenu(companyId);
  }

  // "Quem pediu isso também pediu" — usado no carrinho do cardápio digital
  // pra sugerir upsell real (coocorrência de pedidos, sem IA nenhuma).
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('public/frequently-bought-with/:companyId/:productId')
  frequentlyBoughtWith(
    @Param('companyId') companyId: string,
    @Param('productId') productId: string,
  ) {
    return this.service.getFrequentlyBoughtWith(companyId, productId);
  }

  // Serve sob demanda a imagem de um produto que ainda está salva como
  // base64 no banco (sem Cloudinary configurado) — ver publicMenu().
  @Get('public/image/:id')
  async publicImage(@Param('id') id: string, @Res() res: Response) {
    const { mime, buffer } = await this.service.getPublicImage(id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  }
  @Get('trash')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  findTrash(@Request() req: any) {
    return this.service.findTrash(req.user.companyId);
  }

  @Patch('restore/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  restore(
    @Param('id')
    id: string,
    @Request() req: any,
  ) {
    return this.service.restore(id, req.user.companyId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(
    @Param('id')
    id: string,
    @Request() req: any,
  ) {
    return this.service.remove(id, req.user.companyId);
  }
}
