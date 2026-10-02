import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IENV, IJWT } from 'src/common/config/env.interface';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { JwtPayload } from '../dto/jwt-payload.dto';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { tenantStorage } from '../tenant-context';
import { UsersService } from 'src/modules/users/users.service';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { JwtGuard } from './jwt.guard';

const JWT: IJWT = {
  accessSecret: 'access-secret-access-secret-access',
  refreshSecret: 'refresh-secret-refresh-secret-refresh',
  accessExpiresIn: '1h',
  refreshExpiresIn: '7d',
  issuer: 'test-issuer',
  audience: 'test-audience',
};

const perm = (key: string) => ({ key }) as { key: PermissionKey };

const makeConfig = (): ConfigService<IENV> =>
  ({
    getOrThrow: jest.fn((key: string) => (key === 'jwt' ? JWT : undefined)),
  }) as unknown as ConfigService<IENV>;

const buildReflector = (opts: { isPublic?: boolean; isPlatform?: boolean }) =>
  ({
    getAllAndOverride: jest.fn((key: unknown) => {
      if (key === IS_PUBLIC) return opts.isPublic ?? false;
      if (key === IS_PLATFORM) return opts.isPlatform ?? false;
      return undefined;
    }),
  }) as unknown as Reflector;

const buildContext = (request: Record<string, unknown>): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const tenantEntity = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 10,
    schemaName: 'tenant_acme',
    slug: 'acme',
    status: 'ACTIVE',
    ...overrides,
  }) as Tenant;

describe('JwtGuard', () => {
  let jwt: JwtService;
  let userService: { findOne: jest.Mock; findOnePublic: jest.Mock };
  let config: ConfigService<IENV>;

  const sign = (payload: Partial<JwtPayload>, secret = JWT.accessSecret) =>
    jwt.sign(
      {
        type: 'access',
        id: 1,
        role: RoleKey.CUSTOMER,
        tenantId: null,
        tenantSchema: null,
        ...payload,
      },
      { secret, issuer: JWT.issuer, audience: JWT.audience, expiresIn: '1h' },
    );

  const buildGuard = (
    opts: { isPublic?: boolean; isPlatform?: boolean } = {},
  ) =>
    new JwtGuard(
      buildReflector(opts),
      jwt,
      userService as unknown as UsersService,
      config,
    );

  beforeEach(() => {
    jwt = new JwtService({});
    config = makeConfig();
    userService = {
      findOne: jest.fn(),
      findOnePublic: jest.fn(),
    };
  });

  it('bypasses verification for @Public routes', async () => {
    const verifySpy = jest.spyOn(jwt, 'verify');
    const guard = buildGuard({ isPublic: true });

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).resolves.toBe(true);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('rejects a request with no bearer token', async () => {
    const guard = buildGuard();
    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a malformed or unverifiable token', async () => {
    const guard = buildGuard();
    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: 'Bearer not-a-jwt' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      {
        type: 'access',
        id: 1,
        role: RoleKey.CUSTOMER,
        tenantId: 10,
        tenantSchema: 'tenant_acme',
      } as JwtPayload,
      {
        secret: JWT.accessSecret,
        issuer: JWT.issuer,
        audience: JWT.audience,
        expiresIn: -10,
      },
    );
    const guard = buildGuard();

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: `Bearer ${expired}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a refresh token used as an access token', async () => {
    const token = sign({
      type: 'refresh',
      tenantId: 10,
      tenantSchema: 'tenant_acme',
    });
    const guard = buildGuard();

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a tenant token on a @Platform route', async () => {
    const token = sign({ tenantId: 10, tenantSchema: 'tenant_acme' });
    const guard = buildGuard({ isPlatform: true });

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userService.findOne).not.toHaveBeenCalled();
  });

  it('rejects a platform token on a tenant route', async () => {
    const token = sign({ tenantId: null, tenantSchema: null });
    const guard = buildGuard();

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toThrow('Tenant-scoped token required');
  });

  it('rejects an incomplete tenant claim', async () => {
    const token = sign({ tenantId: 10, tenantSchema: null });
    const guard = buildGuard();

    await expect(
      guard.canActivate(
        buildContext({
          headers: { authorization: `Bearer ${token}` },
          tenant: tenantEntity(),
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a tenant token when no tenant context is resolved', async () => {
    const token = sign({ tenantId: 10, tenantSchema: 'tenant_acme' });
    const guard = buildGuard();

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toThrow('Tenant context is required');
  });

  it('rejects a token whose tenant does not match the resolved tenant', async () => {
    const token = sign({ tenantId: 10, tenantSchema: 'tenant_acme' });
    const guard = buildGuard();

    await expect(
      guard.canActivate(
        buildContext({
          headers: { authorization: `Bearer ${token}` },
          tenant: tenantEntity({ id: 99, schemaName: 'tenant_other' }),
        }),
      ),
    ).rejects.toThrow('Token does not belong to this tenant');
  });

  it('throws NotFoundException when the token user no longer exists', async () => {
    userService.findOne.mockResolvedValue(null);
    const token = sign({ tenantId: 10, tenantSchema: 'tenant_acme' });
    const guard = buildGuard();

    await expect(
      guard.canActivate(
        buildContext({
          headers: { authorization: `Bearer ${token}` },
          tenant: tenantEntity(),
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets request.user and unions role and direct permissions on success', async () => {
    userService.findOne.mockResolvedValue({
      id: 1,
      name: 'Jane',
      email: 'jane@test.dev',
      role: {
        id: 3,
        key: RoleKey.ADMIN,
        permissions: [perm('products:read'), perm('products:update')],
      },
      permissions: [perm('products:read'), perm('users:read')],
    });
    const token = sign({
      id: 1,
      tenantId: 10,
      tenantSchema: 'tenant_acme',
    });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
      tenant: tenantEntity(),
    };
    const guard = buildGuard();

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);

    expect(userService.findOne).toHaveBeenCalledWith(
      { id: 1 },
      { withRole: true, withPermissions: true },
      { id: 10, schemaName: 'tenant_acme' },
    );
    expect(userService.findOnePublic).not.toHaveBeenCalled();
    const user = (request as { user: RequestWithUser['user'] }).user;
    expect(user).toEqual({
      id: 1,
      name: 'Jane',
      email: 'jane@test.dev',
      role: { id: 3, key: RoleKey.ADMIN },
      permissions: ['products:read', 'users:read', 'products:update'],
    });
    expect((request as { tenant?: Tenant }).tenant).toEqual(tenantEntity());
  });

  it('resolves a platform token through findOnePublic', async () => {
    userService.findOnePublic.mockResolvedValue({
      id: 5,
      name: 'Super',
      email: 'super@test.dev',
      role: { id: 99, key: RoleKey.SUPER_ADMIN, permissions: [] },
      permissions: [],
    });
    const token = sign({ id: 5, role: RoleKey.SUPER_ADMIN });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const guard = buildGuard({ isPlatform: true });

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);

    expect(userService.findOnePublic).toHaveBeenCalledWith(
      { id: 5 },
      { withRole: true, withPermissions: true },
    );
    expect(userService.findOne).not.toHaveBeenCalled();
    expect((request as { user: RequestWithUser['user'] }).user.role).toEqual({
      id: 99,
      key: RoleKey.SUPER_ADMIN,
    });
  });

  it('falls back to the AsyncLocalStorage tenant context', async () => {
    userService.findOne.mockResolvedValue({
      id: 1,
      name: 'Jane',
      email: 'jane@test.dev',
      role: null,
      permissions: [],
    });
    const token = sign({ tenantId: 10, tenantSchema: 'tenant_acme' });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const guard = buildGuard();

    const result = await tenantStorage.run(
      { tenant: tenantEntity(), tenantSchema: 'tenant_acme' },
      () => guard.canActivate(buildContext(request)),
    );

    expect(result).toBe(true);
    expect(userService.findOne).toHaveBeenCalledWith(
      { id: 1 },
      { withRole: true, withPermissions: true },
      { id: 10, schemaName: 'tenant_acme' },
    );
    expect((request as { user: RequestWithUser['user'] }).user.role).toBeNull();
  });
});
