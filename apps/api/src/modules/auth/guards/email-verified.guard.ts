import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { ALLOW_UNVERIFIED_EMAIL } from '../decorators/allow-unverified-email.decorator';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';

/**
 * Requires a verified email on every authenticated tenant route.
 *
 * Runs after `JwtGuard` (so `request.user` is populated). `@Public` routes pass
 * (no user), and `@Platform` routes pass (platform users have no tenant OTP
 * flow). A route or controller can opt out with `@AllowUnverifiedEmail()`, which
 * is intended only for recovery paths such as logout.
 *
 * Rejection is `403 { code: 'EMAIL_NOT_VERIFIED' }`.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC,
      targets,
    );
    if (isPublic) return true;

    const isPlatform = this.reflector.getAllAndOverride<boolean>(
      IS_PLATFORM,
      targets,
    );
    if (isPlatform) return true;

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_EMAIL,
      targets,
    );
    if (allowUnverified) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user?.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email is not verified',
      });
    }

    return true;
  }
}
