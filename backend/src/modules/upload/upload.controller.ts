import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

@Controller('upload')
export class UploadController {

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage() }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new InternalServerErrorException('Nenhum arquivo recebido.');

    const cloudinaryUrl = process.env.CLOUDINARY_URL;

    // ─── Cloudinary (production) ─────────────────────────────────────────────
    if (cloudinaryUrl) {
      try {
        // Lazy-require to avoid error if package not installed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const cloudinary = require('cloudinary').v2;
        // cloudinaryUrl already configures the SDK when set via env
        cloudinary.config({ cloudinary_url: cloudinaryUrl });

        const result = await new Promise<any>((resolve, reject) => {
          const { Readable } = require('stream');
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'food-system', resource_type: 'image' },
            (error: any, result: any) => {
              if (error) reject(error);
              else resolve(result);
            },
          );
          Readable.from(file.buffer).pipe(uploadStream);
        });

        return { url: result.secure_url };
      } catch (err) {
        console.error('Cloudinary upload error:', err);
        throw new InternalServerErrorException('Falha no upload para Cloudinary.');
      }
    }

    // ─── Local disk fallback (development / sem Cloudinary) ──────────────────
    const uploadsDir = join(process.cwd(), 'uploads');
    try { mkdirSync(uploadsDir, { recursive: true }); } catch { /* already exists */ }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname)}`;
    writeFileSync(join(uploadsDir, filename), file.buffer);

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    return { url: `${backendUrl}/uploads/${filename}` };
  }
}
