import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConfigService } from '@nestjs/config';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('upload')
export class UploadController {
  constructor(private config: ConfigService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo recebido.');
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de arquivo não suportado: ${file.mimetype}`);
    }

    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');

    // ── 1. Cloudinary (preferred) ─────────────────────────────────────────────
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
            (error: any, res: any) => { if (error) reject(error); else resolve(res); },
          );
          Readable.from(file.buffer).pipe(stream);
        });

        return { url: result.secure_url };
      } catch (err: any) {
        console.error('[Upload] Cloudinary failed:', err?.message);
        // fall through to base64
      }
    }

    // ── 2. Base64 data URL (zero infra) ───────────────────────────────────────
    // Stored directly in the database as a data: URI.
    // Works without any cloud storage; PostgreSQL TEXT has no size limit.
    const mime = ALLOWED_MIMES.includes(file.mimetype) ? file.mimetype : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${file.buffer.toString('base64')}`;
    return { url: dataUrl };
  }
}
