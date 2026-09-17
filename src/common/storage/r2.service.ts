import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { IR2, IENV } from '../config/env.interface';
import { R2Upload } from './interfaces/r2.interface';

const R2_DELETE_BATCH_LIMIT = 50;

@Injectable()
export class R2Service implements OnModuleDestroy {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly config: IR2;

  constructor(config: ConfigService<IENV>) {
    this.config = config.getOrThrow<IR2>('r2');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<R2Upload> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.debug(`Uploaded ${key} (${body.length} bytes)`);
    return { key, sizeBytes: body.length };
  }

  async deleteMany(keys: string[]): Promise<void> {
    const unique = [...new Set(keys)];
    for (let i = 0; i < unique.length; i += R2_DELETE_BATCH_LIMIT) {
      const batch = unique
        .slice(i, i + R2_DELETE_BATCH_LIMIT)
        .map((key) => ({ Key: key }));
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: { Objects: batch },
        }),
      );
    }
    this.logger.debug(`Deleted ${unique.length} objects`);
  }

  publicUrl(key: string): string {
    return `${this.config.publicUrl}/${key}`;
  }

  buildObjectKey(schemaName: string, folder: string, filename: string): string {
    const tenant = this.sanitizeKeySegment(schemaName);
    const dir = this.sanitizeKeySegment(folder);
    const ext = this.sanitizeExtension(filename);
    return `tenants/${tenant}/${dir}/${randomUUID()}.${ext}`;
  }

  async healthy(): Promise<boolean> {
    try {
      await this.client.send(
        new ListObjectsV2Command({ Bucket: this.config.bucket, MaxKeys: 1 }),
      );
      return true;
    } catch (error) {
      this.logger.error(`R2 health check failed: ${String(error)}`);
      return false;
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  private sanitizeKeySegment(segment: string): string {
    const sanitized = segment
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 63);
    if (!sanitized) throw new Error('Invalid object key segment');
    return sanitized;
  }

  private sanitizeExtension(filename: string): string {
    if (!filename.includes('.')) return 'bin';
    const ext = filename.split('.').pop() ?? '';
    const sanitized = ext
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    return sanitized || 'bin';
  }
}
