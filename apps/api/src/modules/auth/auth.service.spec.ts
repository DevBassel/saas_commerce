import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RoleKey } from 'src/common/constants/RoleKey.enum';

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
    findOne: jest.fn(),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue(jwtConfig) };

  const service = new AuthService(
    userService as never,
    jwt,
    config as never,
    {} as never,
    {} as never,
  );

  const user = {
    id: 1,
    jti: 'abc',
    role: { key: RoleKey.STORE_OWNER },
  } as unknown as User;

  beforeEach(() => jest.clearAllMocks());

  it('signs access and refresh with different secrets', async () => {
    const { access_token, refresh_token } =
      await service.returnUserCredential(user);

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

  it('accepts a valid refresh token and rotates the session jti', async () => {
    userService.findOne.mockResolvedValue(user);
    userService.updateSession.mockClear();
    const refreshToken = jwt.sign(
      { type: 'refresh', jti: 'abc', id: 1, role: RoleKey.STORE_OWNER },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: '7d',
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );

    const result = await service.refresh_user_credentials(refreshToken);
    expect(result.access_token).toEqual(expect.any(String));
    expect(result.refresh_token).toEqual(expect.any(String));
    expect(userService.updateSession).toHaveBeenCalledWith(
      1,
      expect.any(String),
      undefined,
    );
    const calls = userService.updateSession.mock.calls as unknown as Array<
      [number, string, unknown]
    >;
    expect(calls[0][1]).not.toBe('abc');
  });

  it('rejects a refresh token whose jti does not match the stored session', async () => {
    userService.findOne.mockResolvedValue({ ...user, jti: 'different' });
    const refreshToken = jwt.sign(
      { type: 'refresh', jti: 'abc', id: 1, role: RoleKey.STORE_OWNER },
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
    userService.findOne.mockResolvedValue(user);
    const refreshToken = jwt.sign(
      { type: 'refresh', id: 1, role: RoleKey.STORE_OWNER },
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
});
