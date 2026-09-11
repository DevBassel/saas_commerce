import { Permission } from './entities/permission.entity';

export const mergePermissions = (
  existing: Permission[] | undefined,
  additions: Permission[],
): Permission[] => {
  const merged = new Map<number, Permission>();
  for (const p of existing ?? []) merged.set(p.id, p);
  for (const p of additions) merged.set(p.id, p);
  return [...merged.values()];
};
