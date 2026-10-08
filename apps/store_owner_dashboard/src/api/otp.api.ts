import { apiClient } from "./client";

/** Tenant-scoped OTP purposes the store owner dashboard uses. */
export type OtpPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

export interface RequestOtpResponse {
  success: boolean;
}

export interface VerifyEmailResponse {
  verified: boolean;
}

export interface ConfirmPasswordResetResponse {
  success: boolean;
}

/** Requests (or resends) a verification / password-reset code. */
export const requestOtp = async (
  email: string,
  purpose: OtpPurpose,
): Promise<RequestOtpResponse> => {
  const response = await apiClient.post<RequestOtpResponse>(
    "auth/email-otp/request",
    { email, purpose },
  );
  return response.data;
};

/** Verifies an email-verification code and marks the email verified. */
export const verifyEmailOtp = async (
  email: string,
  code: string,
): Promise<VerifyEmailResponse> => {
  const response = await apiClient.post<VerifyEmailResponse>(
    "auth/email-otp/verify",
    { email, purpose: "EMAIL_VERIFICATION", code },
  );
  return response.data;
};

/** Completes a password reset; the API rotates the password and revokes sessions. */
export const confirmPasswordReset = async (
  email: string,
  code: string,
  newPassword: string,
): Promise<ConfirmPasswordResetResponse> => {
  const response = await apiClient.post<ConfirmPasswordResetResponse>(
    "auth/password-reset/confirm",
    { email, code, newPassword },
  );
  return response.data;
};
