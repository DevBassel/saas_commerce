import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { TenantStatus } from '../tenants/enums/tenantStatus.enum';

const jwtConfig = {
  accessSecret: `access_${'a'.repeat(64)}`,
  refreshSecret: `refresh_${'b'.repeat(64)}`,
  accessExpiresIn: '5h',
  refreshExpiresIn: '7d',
  issuer: 'saas_store',
  audience: 'saas_store',
};

describe('AuthService token secrets', () => {
  const jwt = new JwtService();
  const userService = {
    updateSession: jest.fn().mockResolvedValue(undefined),
    updateSessionPublic: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    findOnePublic: jest.fn(),
  };
  const tenantService = { findBySchemaName: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue(jwtConfig) };

  const service = new AuthService(
    userService as never,
    jwt,
    config as never,
    tenantService as never,
    {} as never,
  );

  const user = {
    id: 1,
    jti: 'abc',
    role: { key: RoleKey.STORE_OWNER },
  } as unknown as User;

  beforeEach(() => jest.clearAllMocks());

  it('signs access and refresh with different secrets', async () => {
    const { accessToken, refreshToken } =
      await service.returnUserCredential(user);

    expect(() => {
      jwt.verify(accessToken, {
        secret: jwtConfig.accessSecret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
    }).not.toThrow();
    expect(() => {
      jwt.verify(accessToken, {
        secret: jwtConfig.refreshSecret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
    }).toThrow();

    expect(() => {
      jwt.verify(refreshToken, {
        secret: jwtConfig.refreshSecret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
    }).not.toThrow();
    expect(() => {
      jwt.verify(refreshToken, {
        secret: jwtConfig.accessSecret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
    }).toThrow();
  });

  it('rejects tokens that carry no issuer/audience', () => {
    const tokenWithoutClaims = jwt.sign(
      { type: 'access', id: 1, role: RoleKey.CUSTOMER },
      { secret: jwtConfig.accessSecret, expiresIn: '5h' },
    );
    expect(() => {
      jwt.verify(tokenWithoutClaims, {
        secret: jwtConfig.accessSecret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
    }).toThrow();
  });

  it('rejects an access token presented as a refresh token', async () => {
    const accessToken = jwt.sign(
      { type: 'access', id: 1, role: RoleKey.CUSTOMER },
      {
        secret: jwtConfig.accessSecret,
        expiresIn: '5h',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );

    await expect(service.refresh_user_credentials(accessToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid platform refresh token and rotates the session jti', async () => {
    userService.findOnePublic.mockResolvedValue(user);
    userService.updateSessionPublic.mockClear();
    const refreshToken = jwt.sign(
      { type: 'refresh', jti: 'abc', id: 1, role: RoleKey.SUPER_ADMIN },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: '7d',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );

    const result = await service.refresh_user_credentials(refreshToken);
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(userService.updateSessionPublic).toHaveBeenCalledWith(
      1,
      expect.any(String),
    );
    const calls = userService.updateSessionPublic.mock
      .calls as unknown as Array<[number, string]>;
    expect(calls[0][1]).not.toBe('abc');
  });

  it('rejects a refresh token whose jti does not match the stored session', async () => {
    userService.findOnePublic.mockResolvedValue({ ...user, jti: 'different' });
    const refreshToken = jwt.sign(
      { type: 'refresh', jti: 'abc', id: 1, role: RoleKey.SUPER_ADMIN },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: '7d',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );

    await expect(
      service.refresh_user_credentials(refreshToken),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a refresh token without a jti claim', async () => {
    userService.findOnePublic.mockResolvedValue(user);
    const refreshToken = jwt.sign(
      { type: 'refresh', id: 1, role: RoleKey.SUPER_ADMIN },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: '7d',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );

    await expect(
      service.refresh_user_credentials(refreshToken),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('blocks refresh when the tenant is INACTIVE', async () => {
    tenantService.findBySchemaName.mockResolvedValue({
      id: 3,
      schemaName: 'tenant_acme',
      status: TenantStatus.INACTIVE,
    });
    const refreshToken = jwt.sign(
      {
        type: 'refresh',
        jti: 'abc',
        id: 1,
        role: RoleKey.STORE_OWNER,
        tenantId: 3,
        tenantSchema: 'tenant_acme',
      },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: '7d',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );

    await expect(
      service.refresh_user_credentials(refreshToken),
    ).rejects.toThrow(ForbiddenException);
    expect(userService.findOne).not.toHaveBeenCalled();
  });

  it('rejects a refresh token whose tenant claim no longer matches the registry', async () => {
    tenantService.findBySchemaName.mockResolvedValue({
      id: 99,
      schemaName: 'tenant_acme',
      status: TenantStatus.ACTIVE,
    });
    const refreshToken = jwt.sign(
      {
        type: 'refresh',
        jti: 'abc',
        id: 1,
        role: RoleKey.STORE_OWNER,
        tenantId: 3,
        tenantSchema: 'tenant_acme',
      },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: '7d',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );

    await expect(
      service.refresh_user_credentials(refreshToken),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('persists a platform session through the public repository', async () => {
    await service.returnUserCredential(user);
    expect(userService.updateSessionPublic).toHaveBeenCalledWith(
      1,
      expect.any(String),
    );
    expect(userService.updateSession).not.toHaveBeenCalled();
  });

  it('persists a tenant session through the tenant repository', async () => {
    await service.returnUserCredential(user, {
      id: 3,
      schemaName: 'tenant_acme',
    });
    expect(userService.updateSession).toHaveBeenCalledWith(
      1,
      expect.any(String),
      { id: 3, schemaName: 'tenant_acme' },
    );
    expect(userService.updateSessionPublic).not.toHaveBeenCalled();
  });

  it('clears the stored session for a platform logout', async () => {
    await service.logout(1);
    expect(userService.updateSessionPublic).toHaveBeenCalledWith(1, null);
  });

  it('clears the stored session for a tenant logout', async () => {
    await service.logout(1, { id: 3, schemaName: 'tenant_acme' });
    expect(userService.updateSession).toHaveBeenCalledWith(1, null, {
      id: 3,
      schemaName: 'tenant_acme',
    });
  });
});
