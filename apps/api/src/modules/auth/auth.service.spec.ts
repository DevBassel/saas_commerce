import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { TenantStatus } from '../tenants/enums/tenantStatus.enum';
import { Tenant } from '../tenants/entities/tenant.entity';
import { tenantStorage } from './tenant-context';
import { TenantIdentity } from './tenant-ref.util';
import { OtpPurpose } from '../email-otp/constants/otp-purpose.enum';
import { OtpErrorCode } from '../email-otp/constants/otp.constants';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const compareMock = compare as unknown as jest.Mock;
const hashMock = hash as unknown as jest.Mock;

const jwtConfig = {
  accessSecret: `access_${'a'.repeat(64)}`,
  refreshSecret: `refresh_${'b'.repeat(64)}`,
  accessExpiresIn: '5h',
  refreshExpiresIn: '7d',
  issuer: 'saas_store',
  audience: 'saas_store',
};

const otpConfig = { requireEmailVerified: false };

const jwt = new JwtService();
const config = {
  getOrThrow: jest.fn((key: string) => (key === 'otp' ? otpConfig : jwtConfig)),
};

const TENANT: TenantIdentity = { id: 3, schemaName: 'tenant_acme' };
const tenantEntity = {
  id: 3,
  schemaName: 'tenant_acme',
  status: TenantStatus.ACTIVE,
} as Tenant;

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    jti: 'abc',
    role: { key: RoleKey.STORE_OWNER },
    ...overrides,
  }) as unknown as User;

const buildMocks = () => {
  const userService = {
    updateSession: jest.fn().mockResolvedValue(undefined),
    updateSessionPublic: jest.fn().mockResolvedValue(undefined),
    markEmailVerified: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    findOnePublic: jest.fn(),
    create: jest.fn(),
  };
  const tenantService = {
    findBySchemaName: jest.fn(),
    create: jest.fn(),
    setOwnerUserId: jest.fn().mockResolvedValue(undefined),
  };
  const provisioner = { provision: jest.fn().mockResolvedValue(undefined) };
  const subscriptions = {
    ensureFreeSubscription: jest.fn().mockResolvedValue(undefined),
  };
  const emailOtp = {
    request: jest.fn().mockResolvedValue({ success: true }),
    verify: jest.fn(),
  };
  return { userService, tenantService, provisioner, subscriptions, emailOtp };
};

const buildService = (mocks: ReturnType<typeof buildMocks>) =>
  new AuthService(
    mocks.userService as never,
    jwt,
    config as never,
    mocks.tenantService as never,
    mocks.provisioner as never,
    mocks.subscriptions as never,
    mocks.emailOtp as never,
  );

const signRefresh = (payload: Record<string, unknown>) =>
  jwt.sign(
    { type: 'refresh', id: 1, role: RoleKey.SUPER_ADMIN, ...payload },
    {
      secret: jwtConfig.refreshSecret,
      expiresIn: '7d',
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    },
  );

describe('AuthService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = buildMocks();
    service = buildService(mocks);
  });

  describe('token secrets', () => {
    it('signs access and refresh with different secrets', async () => {
      const { access_token, refresh_token } =
        await service.returnUserCredential(makeUser());

      expect(() => {
        jwt.verify(access_token, {
          secret: jwtConfig.accessSecret,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        });
      }).not.toThrow();
      expect(() => {
        jwt.verify(access_token, {
          secret: jwtConfig.refreshSecret,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        });
      }).toThrow();
      expect(() => {
        jwt.verify(refresh_token, {
          secret: jwtConfig.refreshSecret,
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        });
      }).not.toThrow();
      expect(() => {
        jwt.verify(refresh_token, {
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
  });

  describe('returnUserCredential', () => {
    it('persists a platform session through the public repository', async () => {
      const result = await service.returnUserCredential(makeUser());

      expect(result.id).toBe(1);
      expect(result.access_token).toEqual(expect.any(String));
      expect(result.refresh_token).toEqual(expect.any(String));
      expect(mocks.userService.updateSessionPublic).toHaveBeenCalledWith(
        1,
        expect.any(String),
      );
      expect(mocks.userService.updateSession).not.toHaveBeenCalled();
    });

    it('persists a tenant session through the tenant repository', async () => {
      await service.returnUserCredential(makeUser(), TENANT);

      expect(mocks.userService.updateSession).toHaveBeenCalledWith(
        1,
        expect.any(String),
        TENANT,
      );
      expect(mocks.userService.updateSessionPublic).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the stored session for a platform logout', async () => {
      await service.logout(1);
      expect(mocks.userService.updateSessionPublic).toHaveBeenCalledWith(
        1,
        null,
      );
    });

    it('clears the stored session for a tenant logout', async () => {
      await service.logout(1, TENANT);
      expect(mocks.userService.updateSession).toHaveBeenCalledWith(
        1,
        null,
        TENANT,
      );
    });
  });

  describe('register', () => {
    it('forbids registration without a tenant context', async () => {
      await expect(
        service.register({
          name: 'A',
          email: 'a@test.dev',
          password: 'x',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a CUSTOMER within the tenant context', async () => {
      const dto = { name: 'A', email: 'a@test.dev', password: 'x' };

      const result = await tenantStorage.run(
        { tenant: tenantEntity, tenantSchema: TENANT.schemaName },
        () => service.register(dto as never),
      );

      expect(result).toEqual({ success: true, msg: 'register success' });
      expect(mocks.userService.create).toHaveBeenCalledWith(
        dto,
        RoleKey.CUSTOMER,
        tenantEntity,
      );
    });
  });

  describe('registerStore', () => {
    it('provisions the store, creates the owner and issues credentials in order', async () => {
      const order: string[] = [];
      const tenant = { id: 3, schemaName: 'tenant_acme' } as Tenant;
      const owner = makeUser({
        id: 9,
        role: { key: RoleKey.STORE_OWNER } as never,
      });
      mocks.tenantService.create.mockImplementation(() => {
        order.push('create');
        return Promise.resolve(tenant);
      });
      mocks.provisioner.provision.mockImplementation(() => {
        order.push('provision');
        return Promise.resolve();
      });
      mocks.userService.create.mockImplementation(() => {
        order.push('owner');
        return Promise.resolve(owner);
      });
      mocks.tenantService.setOwnerUserId.mockImplementation(() => {
        order.push('setOwner');
        return Promise.resolve();
      });
      mocks.userService.updateSession.mockImplementation(() => {
        order.push('session');
        return Promise.resolve();
      });

      const result = await service.registerStore({
        storeName: 'Acme',
        storeSlug: 'acme',
        subdomain: 'acme',
        name: 'Owner',
        email: 'owner@test.dev',
        password: 'password1',
      });

      expect(order).toEqual([
        'create',
        'provision',
        'owner',
        'setOwner',
        'session',
      ]);
      expect(mocks.tenantService.create).toHaveBeenCalledWith({
        name: 'Acme',
        slug: 'acme',
        subdomain: 'acme',
      });
      expect(mocks.userService.create).toHaveBeenCalledWith(
        { name: 'Owner', email: 'owner@test.dev', password: 'password1' },
        RoleKey.STORE_OWNER,
        tenant,
      );
      expect(mocks.tenantService.setOwnerUserId).toHaveBeenCalledWith(3, 9);
      expect(result.id).toBe(9);
      expect(result.refresh_token).toEqual(expect.any(String));
    });
  });

  describe('login', () => {
    const dto = { email: 'jane@test.dev', password: 'password1' };

    it('throws NotFound when the user does not exist', async () => {
      mocks.userService.findOne.mockResolvedValue(null);

      await expect(
        tenantStorage.run(
          { tenant: tenantEntity, tenantSchema: TENANT.schemaName },
          () => service.login(dto as never),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Unauthorized when the password is wrong', async () => {
      mocks.userService.findOne.mockResolvedValue(
        makeUser({ password: 'hash' }),
      );
      compareMock.mockResolvedValue(false);

      await expect(
        tenantStorage.run(
          { tenant: tenantEntity, tenantSchema: TENANT.schemaName },
          () => service.login(dto as never),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues credentials on success', async () => {
      mocks.userService.findOne.mockResolvedValue(
        makeUser({ password: 'hash' }),
      );
      compareMock.mockResolvedValue(true);

      const result = await tenantStorage.run(
        { tenant: tenantEntity, tenantSchema: TENANT.schemaName },
        () => service.login(dto as never),
      );

      expect(result.access_token).toEqual(expect.any(String));
      expect(mocks.userService.updateSession).toHaveBeenCalledWith(
        1,
        expect.any(String),
        tenantEntity,
      );
    });
  });

  describe('loginPlatform', () => {
    const dto = { email: 'root@test.dev', password: 'password1' };

    it('throws NotFound when the user does not exist', async () => {
      mocks.userService.findOnePublic.mockResolvedValue(null);
      await expect(service.loginPlatform(dto as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws Unauthorized for a non-super-admin', async () => {
      mocks.userService.findOnePublic.mockResolvedValue(
        makeUser({ role: { key: RoleKey.CUSTOMER } as never }),
      );
      await expect(service.loginPlatform(dto as never)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('issues a platform session for a super admin', async () => {
      mocks.userService.findOnePublic.mockResolvedValue(
        makeUser({
          role: { key: RoleKey.SUPER_ADMIN } as never,
          password: 'hash',
        }),
      );
      compareMock.mockResolvedValue(true);

      const result = await service.loginPlatform(dto);

      expect(result.access_token).toEqual(expect.any(String));
      expect(mocks.userService.updateSessionPublic).toHaveBeenCalledWith(
        1,
        expect.any(String),
      );
    });
  });

  describe('refresh_user_credentials', () => {
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

      await expect(
        service.refresh_user_credentials(accessToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a valid platform refresh token and rotates the session jti', async () => {
      mocks.userService.findOnePublic.mockResolvedValue(makeUser());

      const result = await service.refresh_user_credentials(
        signRefresh({ jti: 'abc' }),
      );

      expect(result.access_token).toEqual(expect.any(String));
      expect(result.refresh_token).toEqual(expect.any(String));
      expect(mocks.userService.updateSessionPublic).toHaveBeenCalledWith(
        1,
        expect.any(String),
      );
      const calls = mocks.userService.updateSessionPublic.mock.calls as Array<
        [number, string]
      >;
      expect(calls[0][1]).not.toBe('abc');
    });

    it('accepts a valid tenant refresh token for an ACTIVE tenant', async () => {
      mocks.tenantService.findBySchemaName.mockResolvedValue(tenantEntity);
      mocks.userService.findOne.mockResolvedValue(makeUser());

      const result = await service.refresh_user_credentials(
        signRefresh({
          jti: 'abc',
          role: RoleKey.STORE_OWNER,
          tenantId: 3,
          tenantSchema: 'tenant_acme',
        }),
      );

      expect(result.access_token).toEqual(expect.any(String));
      expect(mocks.userService.findOne).toHaveBeenCalledWith(
        { id: 1 },
        {},
        TENANT,
      );
      expect(mocks.userService.updateSession).toHaveBeenCalledWith(
        1,
        expect.any(String),
        TENANT,
      );
    });

    it('rejects a refresh token whose jti does not match the stored session', async () => {
      mocks.userService.findOnePublic.mockResolvedValue(
        makeUser({ jti: 'different' }),
      );

      await expect(
        service.refresh_user_credentials(signRefresh({ jti: 'abc' })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a refresh token without a jti claim', async () => {
      mocks.userService.findOnePublic.mockResolvedValue(makeUser());

      await expect(
        service.refresh_user_credentials(signRefresh({})),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('blocks refresh when the tenant is INACTIVE', async () => {
      mocks.tenantService.findBySchemaName.mockResolvedValue({
        id: 3,
        schemaName: 'tenant_acme',
        status: TenantStatus.INACTIVE,
      });

      await expect(
        service.refresh_user_credentials(
          signRefresh({
            jti: 'abc',
            role: RoleKey.STORE_OWNER,
            tenantId: 3,
            tenantSchema: 'tenant_acme',
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mocks.userService.findOne).not.toHaveBeenCalled();
    });

    it('rejects a refresh token whose tenant claim no longer matches the registry', async () => {
      mocks.tenantService.findBySchemaName.mockResolvedValue({
        id: 99,
        schemaName: 'tenant_acme',
        status: TenantStatus.ACTIVE,
      });

      await expect(
        service.refresh_user_credentials(
          signRefresh({
            jti: 'abc',
            role: RoleKey.STORE_OWNER,
            tenantId: 3,
            tenantSchema: 'tenant_acme',
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a refresh token signed with a wrong secret', async () => {
      const bad = jwt.sign(
        { type: 'refresh', id: 1, role: RoleKey.CUSTOMER },
        {
          secret: 'wrong-secret-wrong-secret-wrong-secret',
          issuer: jwtConfig.issuer,
          audience: jwtConfig.audience,
        },
      );

      await expect(service.refresh_user_credentials(bad)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

describe('AuthService email OTP flows', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: AuthService;

  const TENANT_CTX = {
    tenant: tenantEntity,
    tenantSchema: TENANT.schemaName,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = buildMocks();
    service = buildService(mocks);
  });

  describe('register', () => {
    it('dispatches an EMAIL_VERIFICATION OTP after creating the user', async () => {
      await tenantStorage.run(TENANT_CTX, () =>
        service.register({
          name: 'A',
          email: 'a@test.dev',
          password: 'password1',
        }),
      );

      expect(mocks.emailOtp.request).toHaveBeenCalledWith({
        email: 'a@test.dev',
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        tenant: tenantEntity,
      });
    });

    it('still registers when the OTP dispatch fails', async () => {
      mocks.emailOtp.request.mockRejectedValue(new Error('smtp down'));

      const result = await tenantStorage.run(TENANT_CTX, () =>
        service.register({
          name: 'A',
          email: 'a@test.dev',
          password: 'password1',
        }),
      );

      expect(result).toEqual({ success: true, msg: 'register success' });
    });
  });

  describe('verifyEmailOtp', () => {
    it('marks the email verified for EMAIL_VERIFICATION', async () => {
      mocks.emailOtp.verify.mockResolvedValue({
        user: makeUser(),
        challenge: {},
      });

      const result = await tenantStorage.run(TENANT_CTX, () =>
        service.verifyEmailOtp({
          email: 'jane@test.dev',
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          code: '123456',
        }),
      );

      expect(result).toEqual({ verified: true });
      expect(mocks.userService.markEmailVerified).toHaveBeenCalledWith(
        1,
        tenantEntity,
      );
    });

    it('issues credentials for LOGIN_MFA', async () => {
      mocks.emailOtp.verify.mockResolvedValue({
        user: makeUser(),
        challenge: {},
      });

      const result = (await tenantStorage.run(TENANT_CTX, () =>
        service.verifyEmailOtp({
          email: 'jane@test.dev',
          purpose: OtpPurpose.LOGIN_MFA,
          code: '123456',
        }),
      )) as { access_token: string; refresh_token: string };

      expect(result.access_token).toEqual(expect.any(String));
      expect(result.refresh_token).toEqual(expect.any(String));
    });

    it('rejects PASSWORD_RESET before consuming the code', async () => {
      const error = (await tenantStorage
        .run(TENANT_CTX, () =>
          service.verifyEmailOtp({
            email: 'jane@test.dev',
            purpose: OtpPurpose.PASSWORD_RESET,
            code: '123456',
          }),
        )
        .catch((e: unknown) => e)) as BadRequestException;

      expect(error.getResponse()).toMatchObject({
        code: OtpErrorCode.PURPOSE_REQUIRES_CONFIRM,
      });
      expect(mocks.emailOtp.verify).not.toHaveBeenCalled();
    });
  });

  describe('confirmPasswordReset', () => {
    it('verifies the code, hashes the password and revokes sessions', async () => {
      mocks.emailOtp.verify.mockResolvedValue({
        user: makeUser(),
        challenge: {},
      });
      hashMock.mockResolvedValue('new-hash');

      const result = await tenantStorage.run(TENANT_CTX, () =>
        service.confirmPasswordReset({
          email: 'jane@test.dev',
          code: '123456',
          newPassword: 'newpass12',
        }),
      );

      expect(result).toEqual({ success: true });
      expect(mocks.emailOtp.verify).toHaveBeenCalledWith({
        email: 'jane@test.dev',
        purpose: OtpPurpose.PASSWORD_RESET,
        code: '123456',
        tenant: tenantEntity,
      });
      expect(mocks.userService.updatePassword).toHaveBeenCalledWith(
        1,
        'new-hash',
        tenantEntity,
      );
    });
  });

  describe('login email-verification gate', () => {
    it('blocks login when the user has not verified their email', async () => {
      otpConfig.requireEmailVerified = true;
      mocks.userService.findOne.mockResolvedValue(
        makeUser({ password: 'hash', emailVerified: false }),
      );
      compareMock.mockResolvedValue(true);

      await expect(
        tenantStorage.run(TENANT_CTX, () =>
          service.login({ email: 'jane@test.dev', password: 'password1' }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mocks.userService.updateSession).not.toHaveBeenCalled();

      otpConfig.requireEmailVerified = false;
    });

    it('allows login when the gate is disabled', async () => {
      mocks.userService.findOne.mockResolvedValue(
        makeUser({ password: 'hash', emailVerified: false }),
      );
      compareMock.mockResolvedValue(true);

      const result = await tenantStorage.run(TENANT_CTX, () =>
        service.login({ email: 'jane@test.dev', password: 'password1' }),
      );

      expect(result.access_token).toEqual(expect.any(String));
    });
  });
});
