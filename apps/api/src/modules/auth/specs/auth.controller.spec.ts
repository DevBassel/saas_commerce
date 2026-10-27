import { Test } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { RegisterStoreDto } from '../dto/register-store.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { RefreshTokenDto } from '../dto/refreshtoken.dto';
import { ConfirmPasswordResetDto } from '../dto/confirm-password-reset.dto';
import type { RequestWithUser } from '../interfaces/RequestWithUser.interface';

const mockAuthService = {
  register: jest.fn(),
  registerStore: jest.fn(),
  login: jest.fn(),
  loginPlatform: jest.fn(),
  refresh_user_credentials: jest.fn(),
  logout: jest.fn(),
  confirmPasswordReset: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: { id: 1, email: 'test@test.dev', role: null, permissions: [] },
    tenant: { id: 1, schemaName: 'tenant_test' },
    ...overrides,
  }) as RequestWithUser;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: typeof mockAuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = moduleRef.get(AuthController);
    authService = moduleRef.get(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('delegates to AuthService.register with the DTO', async () => {
      const dto: CreateUserDto = {
        name: 'Test',
        email: 'test@test.dev',
        password: 'password123',
      };
      const expected = {
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 1, email: dto.email },
      };
      authService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('registerStore', () => {
    it('delegates to AuthService.registerStore with the DTO', async () => {
      const dto: RegisterStoreDto = {
        name: 'Test',
        email: 'test@test.dev',
        password: 'password123',
        storeName: 'Store',
        storeSlug: 'store',
      };
      const expected = {
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 1, email: dto.email },
      };
      authService.registerStore.mockResolvedValue(expected);

      const result = await controller.registerStore(dto);

      expect(authService.registerStore).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('login', () => {
    it('delegates to AuthService.login with the DTO', async () => {
      const dto: LoginUserDto = {
        email: 'test@test.dev',
        password: 'password123',
      };
      const expected = {
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 1, email: dto.email },
      };
      authService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('loginPlatform', () => {
    it('delegates to AuthService.loginPlatform with the DTO', async () => {
      const dto: LoginUserDto = {
        email: 'admin@platform.dev',
        password: 'password123',
      };
      const expected = {
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 1, email: dto.email },
      };
      authService.loginPlatform.mockResolvedValue(expected);

      const result = await controller.loginPlatform(dto);

      expect(authService.loginPlatform).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('refresh', () => {
    it('delegates to AuthService.refresh_user_credentials with the refresh token', async () => {
      const dto: RefreshTokenDto = { refresh_token: 'refresh-token' };
      const expected = {
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        user: { id: 1 },
      };
      authService.refresh_user_credentials.mockResolvedValue(expected);

      const result = await controller.refresh(dto);

      expect(authService.refresh_user_credentials).toHaveBeenCalledWith(
        dto.refresh_token,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('logout', () => {
    it('delegates to AuthService.logout with user id and tenant', async () => {
      const req = makeRequest();
      authService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout(req);

      expect(authService.logout).toHaveBeenCalledWith(req.user.id, req.tenant);
      expect(result).toEqual({ success: true });
    });
  });

  describe('logoutPlatform', () => {
    it('delegates to AuthService.logout with user id (no tenant)', async () => {
      const req = makeRequest({ tenant: undefined });
      authService.logout.mockResolvedValue({ success: true });

      const result = await controller.logoutPlatform(req);

      expect(authService.logout).toHaveBeenCalledWith(req.user.id);
      expect(result).toEqual({ success: true });
    });
  });

  describe('confirmPasswordReset', () => {
    it('delegates to AuthService.confirmPasswordReset with the DTO', async () => {
      const dto: ConfirmPasswordResetDto = {
        email: 'test@test.dev',
        code: '123456',
        newPassword: 'newpassword123',
      };
      authService.confirmPasswordReset.mockResolvedValue({ success: true });

      const result = await controller.confirmPasswordReset(dto);

      expect(authService.confirmPasswordReset).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true });
    });
  });
});
