import { User } from './entities/user.entity';
import { presentUser } from './user.presenter';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 5,
    name: 'Jane',
    email: 'jane@example.com',
    emailVerified: false,
    roleId: 3,
    role: {
      id: 3,
      key: 'ADMIN',
      name: 'Admin',
      permissions: [{ id: 99, key: 'role:only', name: 'Role only' }],
    },
    permissions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  }) as User;

describe('presentUser', () => {
  it('returns role identity without nested permissions', () => {
    const result = presentUser(makeUser());

    expect(result.role).toEqual({ id: 3, key: 'ADMIN', name: 'Admin' });
    expect(result.role).not.toHaveProperty('permissions');
  });

  it('maps direct permissions to sorted {id,key,name} objects', () => {
    const result = presentUser(
      makeUser({
        permissions: [
          { id: 2, key: 'users:read', name: 'Read users' },
          { id: 1, key: 'products:read', name: 'Read products' },
        ] as User['permissions'],
      }),
    );

    expect(result.permissions).toEqual([
      { id: 1, key: 'products:read', name: 'Read products' },
      { id: 2, key: 'users:read', name: 'Read users' },
    ]);
  });

  it('returns null role and roleId when the user has no role', () => {
    const result = presentUser(makeUser({ role: undefined, roleId: null }));

    expect(result.role).toBeNull();
    expect(result.roleId).toBeNull();
  });

  it('returns an empty permissions array when none are loaded', () => {
    const result = presentUser(makeUser({ permissions: undefined }));

    expect(result.permissions).toEqual([]);
  });

  it('never emits password or jti', () => {
    const user = makeUser();
    (user as unknown as { password: string }).password = 'secret';
    (user as unknown as { jti: string }).jti = 'token-id';

    const result = presentUser(user) as unknown as Record<string, unknown>;

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('jti');
  });
});
