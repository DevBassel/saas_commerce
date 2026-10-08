import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_EMAIL = 'allowUnverifiedEmail';

/**
 * Opt-out escape hatch for authenticated tenant routes that must stay reachable
 * while the user's email is still unverified (for example logout, or routes a
 * client needs to recover the account). Every other authenticated tenant route
 * is rejected with 403 `EMAIL_NOT_VERIFIED` by `EmailVerifiedGuard`.
 */
export const AllowUnverifiedEmail = () =>
  SetMetadata(ALLOW_UNVERIFIED_EMAIL, true);
