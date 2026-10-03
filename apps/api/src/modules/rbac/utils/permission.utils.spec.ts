import { Permission } from '../entities/permission.entity';
import { mergePermissions } from './permission.utils';

const permission = (id: number, key = `p:${id}`): Permission =>
  ({ id, key, name: key }) as Permission;

describe('mergePermissions', () => {
  it('returns the additions when there are no existing permissions', () => {
    const additions = [permission(1), permission(2)];
    expect(mergePermissions(undefined, additions)).toEqual(additions);
    expect(mergePermissions([], additions)).toEqual(additions);
  });

  it('dedupes by id with additions overriding existing entries', () => {
    const existing = [permission(1, 'old'), permission(2)];
    const additions = [permission(1, 'new'), permission(3)];

    const result = mergePermissions(existing, additions);

    expect(result).toHaveLength(3);
    expect(result.find((p) => p.id === 1)?.key).toBe('new');
  });

  it('preserves existing order, appending new ids in addition order', () => {
    const result = mergePermissions(
      [permission(2), permission(1)],
      [permission(3), permission(1)],
    );

    expect(result.map((p) => p.id)).toEqual([2, 1, 3]);
  });

  it('does not mutate the input arrays', () => {
    const existing = [permission(1)];
    const additions = [permission(1), permission(2)];

    mergePermissions(existing, additions);

    expect(existing).toHaveLength(1);
    expect(additions).toHaveLength(2);
  });

  it('handles additions that are all duplicates', () => {
    const existing = [permission(1), permission(2)];
    const result = mergePermissions(existing, [permission(1), permission(2)]);
    expect(result).toHaveLength(2);
  });
});
