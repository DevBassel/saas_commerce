import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

const MAX_OUTPUT_BYTES = 500 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MIN_DIMENSION = 320;

const QUALITY_LEVELS = [84, 78, 72, 66, 60];
const SCALE_LEVELS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

interface ImagePreset {
  maxWidth: number;
  maxHeight: number;
}

export interface OptimizedImage {
  body: Buffer;
  contentType: string;
  extension: string;
  optimized: boolean;
}

@Injectable()
export class R2ImageOptimizerService {
  private readonly logger = new Logger(R2ImageOptimizerService.name);

  private readonly presets: Record<string, ImagePreset> = {
    product: {
      maxWidth: 2000,
      maxHeight: 2000,
    },
    category: {
      maxWidth: 1600,
      maxHeight: 1600,
    },
    banner: {
      maxWidth: 1920,
      maxHeight: 1080,
    },
    logo: {
      maxWidth: 800,
      maxHeight: 800,
    },
    default: {
      maxWidth: 1600,
      maxHeight: 1600,
    },
  };

  async optimize(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<OptimizedImage> {
    if (!contentType.toLowerCase().startsWith('image/')) {
      return {
        body,
        contentType,
        extension: this.getExtension(key),
        optimized: false,
      };
    }

    if (!body?.length) throw new BadRequestException('Image cannot be empty');

    try {
      const image = sharp(body, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
        animated: true,
      });

      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height || !metadata.format)
        throw new BadRequestException('Invalid image dimensions');

      // Preserve SVG because converting vector graphics to WebP
      // can introduce unnecessary quality loss.
      if (metadata.format === 'svg')
        return {
          body,
          contentType: 'image/svg+xml',
          extension: 'svg',
          optimized: false,
        };

      // Preserve animated files instead of converting only
      // their first frame into a static WebP.
      if ((metadata.pages ?? 1) > 1)
        return {
          body,
          contentType,
          extension: this.getExtension(key),
          optimized: false,
        };

      const preset = this.getPreset(key);

      const originalWidth = metadata.width;
      const originalHeight = metadata.height;

      const maxScale = Math.min(
        1,
        preset.maxWidth / originalWidth,
        preset.maxHeight / originalHeight,
      );

      for (const scale of SCALE_LEVELS) {
        const effectiveScale = maxScale * scale;

        const width = Math.max(1, Math.round(originalWidth * effectiveScale));

        const height = Math.max(1, Math.round(originalHeight * effectiveScale));

        // Avoid excessive degradation for small images.
        if (scale < 1 && Math.max(width, height) < MIN_DIMENSION) {
          break;
        }

        for (const quality of QUALITY_LEVELS) {
          const output = await sharp(body, {
            failOn: 'error',
            limitInputPixels: MAX_INPUT_PIXELS,
          })
            .rotate()
            .resize({
              width,
              height,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({
              quality,
              effort: 5,
              smartSubsample: true,
            })
            .toBuffer();

          if (output.length <= MAX_OUTPUT_BYTES) {
            this.logger.debug(
              `Optimized ${key}: ${body.length} -> ${output.length} bytes`,
            );

            return {
              body: output,
              contentType: 'image/webp',
              extension: 'webp',
              optimized: true,
            };
          }
        }
      }

      throw new BadRequestException(
        'Unable to optimize image below 500 KB without excessive quality loss. Please upload a smaller image.',
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn(`Image optimization failed: ${String(error)}`);

      throw new BadRequestException('Invalid or unsupported image file');
    }
  }

  private getPreset(key: string): ImagePreset {
    const folder = key
      .split('/')
      .filter(Boolean)
      .slice(-2, -1)[0]
      ?.toLowerCase();

    if (!folder) return this.presets.default;

    if (/products?/.test(folder)) return this.presets.product;

    if (/categories?/.test(folder)) return this.presets.category;

    if (/banners?/.test(folder)) return this.presets.banner;

    if (/logos?/.test(folder)) return this.presets.logo;

    return this.presets.default;
  }

  private getExtension(key: string): string {
    const filename = key.split('/').pop() ?? '';
    const extension = filename.split('.').pop() ?? '';

    return extension.toLowerCase() || 'bin';
  }
}
