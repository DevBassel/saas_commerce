import { SeederRegistry } from './seeder-registry.service';
import { PlatformSeeder } from './interfaces/seeder.interface';
import { TenantSeeder } from './interfaces/tenant-seeder.interface';

const platform = (
  name: string,
  order: number,
  optIn = false,
): PlatformSeeder => ({ name, order, optIn, run: jest.fn() });

const tenant = (name: string, order: number, optIn = false): TenantSeeder => ({
  name,
  order,
  optIn,
  run: jest.fn(),
});

const build = (p: PlatformSeeder[] = [], t: TenantSeeder[] = []) => {
  const registry = new SeederRegistry(p, t);
  registry.onModuleInit();
  return registry;
};

describe('SeederRegistry', () => {
  it('sorts platform seeders by order then name', () => {
    const registry = build([
      platform('roles', 20),
      platform('permissions', 10),
      platform('alpha', 50),
      platform('beta', 50),
    ]);

    expect(registry.platformNames).toEqual([
      'permissions',
      'roles',
      'alpha',
      'beta',
    ]);
  });

  it('tolerates duplicate orders and rejects duplicate names', () => {
    expect(() => build([platform('a', 10), platform('a', 20)])).toThrow(
      /Duplicate platform seeder name "a"/,
    );
  });

  it('sorts tenant seeders independently', () => {
    const registry = build(
      [],
      [tenant('roles', 20), tenant('permissions', 10)],
    );
    expect(registry.tenantNames).toEqual(['permissions', 'roles']);
  });

  it('skips opt-in seeders for "run all" but allows explicit selection', () => {
    const registry = build(
      [platform('permissions', 10)],
      [tenant('permissions', 10), tenant('categories', 50, true)],
    );

    expect(registry.getTenant().map((s) => s.name)).toEqual(['permissions']);
    expect(registry.getTenant(['categories']).map((s) => s.name)).toEqual([
      'categories',
    ]);
  });

  it('throws with the valid names for an unknown seeder', () => {
    const registry = build([platform('permissions', 10)]);

    expect(() => registry.getPlatform(['nope'])).toThrow(
      /Unknown platform seeder\(s\): nope\. Valid: permissions/,
    );
  });

  it('exposes name existence checks', () => {
    const registry = build(
      [platform('permissions', 10)],
      [tenant('roles', 20)],
    );

    expect(registry.hasPlatform('permissions')).toBe(true);
    expect(registry.hasPlatform('roles')).toBe(false);
    expect(registry.hasTenant('roles')).toBe(true);
  });
});
