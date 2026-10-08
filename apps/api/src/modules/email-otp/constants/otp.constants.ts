import { BadRequestException } from '@nestjs/common';

export const OtpErrorCode = {
  INVALID: 'OTP_INVALID',
  EXPIRED: 'OTP_EXPIRED',
  ALREADY_USED: 'OTP_ALREADY_USED',
  TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  PURPOSE_REQUIRES_CONFIRM: 'OTP_PURPOSE_REQUIRES_CONFIRM',
  PURPOSE_NOT_SUPPORTED: 'OTP_PURPOSE_NOT_SUPPORTED',
} as const;

export type OtpErrorCode = (typeof OtpErrorCode)[keyof typeof OtpErrorCode];

export const OTP_ERROR_MESSAGES: Record<OtpErrorCode, string> = {
  [OtpErrorCode.INVALID]: 'The verification code is invalid',
  [OtpErrorCode.EXPIRED]: 'The verification code has expired',
  [OtpErrorCode.ALREADY_USED]: 'The verification code has already been used',
  [OtpErrorCode.TOO_MANY_ATTEMPTS]:
    'Too many incorrect attempts; request a new code',
  [OtpErrorCode.PURPOSE_REQUIRES_CONFIRM]:
    'This code must be confirmed via the password reset endpoint',
  [OtpErrorCode.PURPOSE_NOT_SUPPORTED]: 'This OTP purpose is not supported',
};

export const otpError = (
  code: OtpErrorCode,
  message: string = OTP_ERROR_MESSAGES[code],
): BadRequestException => new BadRequestException({ code, message });
