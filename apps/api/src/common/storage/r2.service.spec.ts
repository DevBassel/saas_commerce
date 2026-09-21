import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { R2Service } from './r2.service';
import { IENV, IR2, IFiles } from '../config/env.interface';

const mockSend = jest.fn() as jest.Mock<Promise<unknown>, [unknown]>;

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3') as unknown as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
      destroy: jest.fn(),
    })),
  };
});

const r2Config: IR2 = {
  accountId: 'test_account',
  accessKeyId: 'test_key',
  secretAccessKey: 'test_secret',
  bucket: 'test-bucket',
  publicUrl: 'https://cdn.example.com',
};

const filesConfig: IFiles = {
  maxFileSize: 5 * 1024 * 1024,
  maxProductImages: 10,
};

interface ClientOptions {
  endpoint: string;
  region: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
}

const buildService = (): R2Service => {
  const config = {
    get: (key: string) =>
      key === 'r2' ? r2Config : key === 'files' ? filesConfig : undefined,
    getOrThrow: (key: string) =>
      key === 'r2' ? r2Config : key === 'files' ? filesConfig : undefined,
  } as unknown as ConfigService<IENV>;
  mockSend.mockReset();
  return new R2Service(config);
};

const lastClientOptions = (): ClientOptions => {
  const calls = (S3Client as unknown as jest.Mock).mock.calls as unknown[][];
  return calls.at(-1)?.[0] as ClientOptions;
};

const sendCall = <T>(index: number): T => mockSend.mock.calls[index][0] as T;

describe('R2Service', () => {
  it('configures the S3Client with the R2 endpoint', () => {
    buildService();
    const options = lastClientOptions();
    expect(options.endpoint).toBe(
      'https://test_account.r2.cloudflarestorage.com',
    );
    expect(options.region).toBe('auto');
    expect(options.credentials).toEqual({
      accessKeyId: 'test_key',
      secretAccessKey: 'test_secret',
    });
  });

  it('uploads a buffer and returns key + size', async () => {
    const service = buildService();
    mockSend.mockResolvedValue({});

    const result = await service.upload('k', Buffer.from('data'), 'image/png');

    expect(result).toEqual({ key: 'k', sizeBytes: 4 });
    const command = sendCall<PutObjectCommand>(0);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('test-bucket');
    expect(command.input.Key).toBe('k');
    expect(command.input.ContentType).toBe('image/png');
  });

  it('builds public URLs', () => {
    const service = buildService();
    expect(service.publicUrl('tenants/a/products/1/x.png')).toBe(
      'https://cdn.example.com/tenants/a/products/1/x.png',
    );
  });

  it('builds tenant-scoped object keys with uuid + sanitized extension', () => {
    const service = buildService();
    const key = service.buildObjectKey(
      'tenant_my-store',
      'products',
      'photo.PNG',
    );
    expect(key).toMatch(
      /^tenants\/tenant_my-store\/products\/[0-9a-f-]{36}\.png$/,
    );
  });

  it('sanitizes unsafe key segments', () => {
    const service = buildService();
    const key = service.buildObjectKey('Bad Schema!', 'products', 'x');
    expect(key.startsWith('tenants/bad-schema-/products/')).toBe(true);
  });

  it('falls back to bin extension for extensionless files', () => {
    const service = buildService();
    const key = service.buildObjectKey('t', 'products', 'noext');
    expect(key.endsWith('.bin')).toBe(true);
  });

  it('deletes keys in a single batch under the limit', async () => {
    const service = buildService();
    mockSend.mockResolvedValue({});

    await service.deleteMany(['a', 'b', 'a']);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = sendCall<DeleteObjectsCommand>(0);
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
    expect(command.input.Delete?.Objects).toEqual([{ Key: 'a' }, { Key: 'b' }]);
  });

  it('chunks deletes above the batch limit', async () => {
    const service = buildService();
    mockSend.mockResolvedValue({});

    const keys = Array.from({ length: 1500 }, (_, i) => `k${i}`);
    await service.deleteMany(keys);

    expect(mockSend).toHaveBeenCalledTimes(2);
    const first = sendCall<DeleteObjectsCommand>(0);
    const second = sendCall<DeleteObjectsCommand>(1);
    expect(first.input.Delete?.Objects).toHaveLength(1000);
    expect(second.input.Delete?.Objects).toHaveLength(500);
  });

  it('reports healthy when list succeeds', async () => {
    const service = buildService();
    mockSend.mockResolvedValue({ Contents: [] });

    await expect(service.healthy()).resolves.toBe(true);
    expect(sendCall<ListObjectsV2Command>(0)).toBeInstanceOf(
      ListObjectsV2Command,
    );
  });

  it('reports unhealthy when list fails', async () => {
    const service = buildService();
    mockSend.mockRejectedValue(new Error('boom'));

    await expect(service.healthy()).resolves.toBe(false);
  });
});
