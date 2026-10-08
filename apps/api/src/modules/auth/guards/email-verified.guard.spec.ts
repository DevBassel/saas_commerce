import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { EmailVerifiedGuard } from './email-verified.guard';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { ALLOW_UNVERIFIED_EMAIL } from '../decorators/allow-unverified-email.decorator';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';

interface Meta {
  isPublic?: boolean;
  isPlatform?: boolean;
  allowUnverified?: boolean;
}

const buildGuard = (meta: Meta, user?: Partial<RequestWithUser['user']>) => {
  const reflector = {
    getAllAndOverride: jest.fn((key: unknown) => {
      if (key === IS_PUBLIC) return meta.isPublic;
      if (key === IS_PLATFORM) return meta.isPlatform;
      if (key === ALLOW_UNVERIFIED_EMAIL) return meta.allowUnverified;
      return undefined;
    }),
  };
  const guard = new EmailVerifiedGuard(reflector as never);
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => (user ? { user } : {}),
    }),
  } as unknown as ExecutionContext;
  return { guard, context };
};

describe('EmailVerifiedGuard', () => {
  it('passes @Public routes', () => {
    const { guard, context } = buildGuard({ isPublic: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('passes @Platform routes', () => {
    const { guard, context } = buildGuard({ isPlatform: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('passes an opted-out route even when unverified', () => {
    const { guard, context } = buildGuard(
      { allowUnverified: true },
      { emailVerified: false },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('passes a verified user on a normal authenticated route', () => {
    const { guard, context } = buildGuard({}, { emailVerified: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an unverified user on a normal authenticated route', () => {
    const { guard, context } = buildGuard({}, { emailVerified: false });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
  });

  it('rejects an authenticated route with no user', () => {
    const { guard, context } = buildGuard({});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
