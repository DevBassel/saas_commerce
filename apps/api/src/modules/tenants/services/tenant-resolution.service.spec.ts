import { ConfigService } from '@nestjs/config';
import { IENV } from 'src/common/config/env.interface';
import { Tenant } from '../entities/tenant.entity';
import { TenantService } from '../tenant.service';
import { TenantResolutionService } from './tenant-resolution.service';

const makeConfig = (): ConfigService<IENV> =>
  ({
    getOrThrow: jest.fn(() => ({
      apiPrefix: 'api',
      apiVersion: 'v1',
      rootDomain: 'example.com',
    })),
  }) as unknown as ConfigService<IENV>;

const makeTenantService = () =>
  ({
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findBySubdomain: jest.fn(),
  }) as unknown as jest.Mocked<
    Pick<TenantService, 'findById' | 'findBySlug' | 'findBySubdomain'>
  >;

const tenant = (overrides: Partial<Tenant> = {}): Tenant =>
  ({ id: 1, schemaName: 'tenant_acme', slug: 'acme', ...overrides }) as Tenant;

describe('TenantResolutionService', () => {
  let config: ConfigService<IENV>;
  let tenantService: ReturnType<typeof makeTenantService>;
  let service: TenantResolutionService;

  beforeEach(() => {
    config = makeConfig();
    tenantService = makeTenantService();
    service = new TenantResolutionService(
      config,
      tenantService as unknown as TenantService,
    );
  });

  describe('isApiPath', () => {
    it.each([
      ['/api/v1', true],
      ['/api/v1/', true],
      ['/api/v1/products', true],
      ['/api/v1-json', true],
      ['/api/v1-json/docs', true],
      ['/', false],
      ['/other', false],
      ['/api/v2', false],
      ['/api/v1x/products', false],
    ])('%s -> %s', (url, expected) => {
      expect(service.isApiPath(url)).toBe(expected);
    });
  });

  describe('hasTenantIdentifier', () => {
    it('is true when x-tenant-id is present', () => {
      expect(
        service.hasTenantIdentifier({ headers: { 'x-tenant-id': '1' } }),
      ).toBe(true);
    });

    it('is true when x-tenant-slug is present', () => {
      expect(
        service.hasTenantIdentifier({ headers: { 'x-tenant-slug': 'acme' } }),
      ).toBe(true);
    });

    it('is true when the host carries a subdomain', () => {
      expect(
        service.hasTenantIdentifier({ headers: { host: 'acme.example.com' } }),
      ).toBe(true);
    });

    it('is false for the apex host', () => {
      expect(
        service.hasTenantIdentifier({ headers: { host: 'example.com' } }),
      ).toBe(false);
    });

    it('is false when nothing identifies a tenant', () => {
      expect(service.hasTenantIdentifier({ headers: {} })).toBe(false);
    });
  });

  describe('resolveFromRequest', () => {
    it('prefers x-tenant-id and never consults slug/subdomain', async () => {
      tenantService.findById.mockResolvedValue(tenant());
      tenantService.findBySlug.mockResolvedValue(null);
      tenantService.findBySubdomain.mockResolvedValue(null);

      const result = await service.resolveFromRequest({
        headers: {
          'x-tenant-id': '42',
          'x-tenant-slug': 'other',
          host: 'other.example.com',
        },
      });

      expect(result).toEqual(tenant());
      expect(tenantService.findById).toHaveBeenCalledWith(42);
      expect(tenantService.findBySlug).not.toHaveBeenCalled();
      expect(tenantService.findBySubdomain).not.toHaveBeenCalled();
    });

    it('swallows errors from an invalid x-tenant-id', async () => {
      tenantService.findById.mockRejectedValue(new Error('Tenant not found'));

      await expect(
        service.resolveFromRequest({
          headers: { 'x-tenant-id': 'not-a-number' },
        }),
      ).resolves.toBeUndefined();
      expect(tenantService.findById).toHaveBeenCalledWith(NaN);
    });

    it('resolves from x-tenant-slug when there is no id', async () => {
      tenantService.findBySlug.mockResolvedValue(tenant());

      await expect(
        service.resolveFromRequest({ headers: { 'x-tenant-slug': 'acme' } }),
      ).resolves.toEqual(tenant());
      expect(tenantService.findBySlug).toHaveBeenCalledWith('acme');
    });

    it('does not fall back to the subdomain when a slug misses (no cross-tenant fallback)', async () => {
      tenantService.findBySlug.mockResolvedValue(null);

      const result = await service.resolveFromRequest({
        headers: { 'x-tenant-slug': 'unknown', host: 'acme.example.com' },
      });

      expect(result).toBeUndefined();
      expect(tenantService.findBySubdomain).not.toHaveBeenCalled();
    });

    it('resolves from the subdomain and strips the port', async () => {
      tenantService.findBySubdomain.mockResolvedValue(tenant());

      const result = await service.resolveFromRequest({
        headers: { host: 'acme.example.com:5174' },
      });

      expect(result).toEqual(tenant());
      expect(tenantService.findBySubdomain).toHaveBeenCalledWith('acme');
    });

    it('returns undefined for the apex host', async () => {
      await expect(
        service.resolveFromRequest({ headers: { host: 'example.com' } }),
      ).resolves.toBeUndefined();
      expect(tenantService.findBySubdomain).not.toHaveBeenCalled();
    });

    it('returns undefined when no identifier is present', async () => {
      await expect(
        service.resolveFromRequest({ headers: {} }),
      ).resolves.toBeUndefined();
    });

    it('converts a null subdomain lookup into undefined', async () => {
      tenantService.findBySubdomain.mockResolvedValue(null);

      await expect(
        service.resolveFromRequest({ headers: { host: 'acme.example.com' } }),
      ).resolves.toBeUndefined();
    });
  });
});
