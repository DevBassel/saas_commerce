import { DataSource } from 'typeorm';
import { HealthController } from '../health.controller';
import { R2Service } from '../../storage/r2.service';
import { TenantCacheService } from '../../cache/tenant-cache.service';

const CACHE = {
  enabled: true,
  driver: 'redis',
  connected: true,
};

const buildController = () => {
  const query = jest.fn();
  const healthy = jest.fn();
  const cacheStats = jest.fn().mockResolvedValue(CACHE);
  const dataSource = { query } as unknown as DataSource;
  const r2 = { healthy } as unknown as R2Service;
  const cache = { stats: cacheStats } as unknown as TenantCacheService;

  const controller = new HealthController(dataSource, r2, cache);

  return { controller, query, healthy, cacheStats };
};

describe('HealthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports ok when db and R2 are both healthy', async () => {
    const { controller, query, healthy } = buildController();
    query.mockResolvedValue([{ '?column?': 1 }]);
    healthy.mockResolvedValue(true);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: true,
      r2: true,
      cache: CACHE,
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports degraded when R2 is unhealthy', async () => {
    const { controller, query, healthy } = buildController();
    query.mockResolvedValue([]);
    healthy.mockResolvedValue(false);

    await expect(controller.check()).resolves.toEqual({
      status: 'degraded',
      db: true,
      r2: false,
      cache: CACHE,
    });
  });

  it('reports degraded when the database query throws', async () => {
    const { controller, query, healthy } = buildController();
    query.mockRejectedValue(new Error('db down'));
    healthy.mockResolvedValue(true);

    await expect(controller.check()).resolves.toEqual({
      status: 'degraded',
      db: false,
      r2: true,
      cache: CACHE,
    });
  });

  it('reports degraded when both dependencies fail', async () => {
    const { controller, query, healthy } = buildController();
    query.mockRejectedValue(new Error('db down'));
    healthy.mockResolvedValue(false);

    await expect(controller.check()).resolves.toEqual({
      status: 'degraded',
      db: false,
      r2: false,
      cache: CACHE,
    });
  });

  it('propagates a rejecting R2 probe (only pingDb is guarded)', async () => {
    const { controller, query, healthy } = buildController();
    query.mockResolvedValue([]);
    healthy.mockRejectedValue(new Error('r2 down'));

    await expect(controller.check()).rejects.toThrow('r2 down');
  });

  it('checks db and R2 together even when db fails', async () => {
    const { controller, query, healthy } = buildController();
    query.mockRejectedValue(new Error('db down'));
    healthy.mockResolvedValue(true);

    await controller.check();

    expect(query).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
