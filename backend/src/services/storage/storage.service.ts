/**
 * StorageService — centralised image persistence.
 *
 * Priority chain:
 *  1. Cloudinary  — if CLOUDINARY_URL env var is set (permanent CDN, best option)
 *  2. Base64      — converts buffer → data:image/<mime>;base64,… stored in DB
 *                   Works with zero external accounts; PostgreSQL TEXT has no practical size limit.
 *
 * ⚠️  Local-disk fallback removed intentionally:
 *     Render free tier has an ephemeral filesystem that resets on every
 *     deploy/restart, making /uploads/* URLs instantly stale.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SUPPORTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly cloudinaryUrl: string | undefined;

  constructor(private config: ConfigService) {
    this.cloudinaryUrl = config.get<string>('CLOUDINARY_URL');
    if (this.cloudinaryUrl) {
      this.logger.log('Storage: Cloudinary configured ✓');
    } else {
      this.logger.warn(
        'Storage: CLOUDINARY_URL not set — falling back to base64 (DB storage). ' +
        'Set CLOUDINARY_URL on Render for persistent CDN URLs.',
      );
    }
  }

  /**
   * Persist an image and return a permanent URL (or data URL).
   * @param buffer  Raw file bytes
   * @param mimeType MIME type string, e.g. "image/jpeg"
   * @param folder  Cloudinary folder name (ignored for base64 path)
   */
  async upload(buffer: Buffer, mimeType: string, folder = 'food-system'): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file received');
    }
    if (buffer.length > MAX_BYTES) {
      throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
    }
    if (!SUPPORTED_MIME.includes(mimeType)) {
      // Accept unknown types but normalise to jpeg for storage
      mimeType = 'image/jpeg';
    }

    // ── 1. Cloudinary ─────────────────────────────────────────────────────────
    if (this.cloudinaryUrl) {
      try {
        const url = await this.uploadToCloudinary(buffer, folder);
        this.logger.log(`Storage: Cloudinary OK → ${url.slice(0, 80)}…`);
        return url;
      } catch (err: any) {
        this.logger.error(`Storage: Cloudinary failed (${err?.message}) — falling back to base64`);
      }
    }

    // ── 2. Base64 data URL ────────────────────────────────────────────────────
    const b64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${b64}`;
    this.logger.log(`Storage: base64 data URL created (${(dataUrl.length / 1024).toFixed(0)} KB)`);
    return dataUrl;
  }

  private async uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloudinary_url: this.cloudinaryUrl });

    return new Promise<string>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Readable } = require('stream');
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error: any, result: any) => {
          if (error) reject(new Error(error.message ?? 'Cloudinary error'));
          else resolve(result.secure_url);
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }
}
