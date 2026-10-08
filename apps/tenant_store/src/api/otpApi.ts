import { apiClient } from "./apiClient";

/** Tenant-scoped OTP purposes the storefront uses. */
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
export async function requestOtp(
  email: string,
  purpose: OtpPurpose,
): Promise<RequestOtpResponse> {
  const res = await apiClient.post("/auth/email-otp/request", {
    email,
    purpose,
  });
  return res.data;
}

/** Verifies an email-verification code and marks the email verified. */
export async function verifyEmailOtp(
  email: string,
  code: string,
): Promise<VerifyEmailResponse> {
  const res = await apiClient.post("/auth/email-otp/verify", {
    email,
    purpose: "EMAIL_VERIFICATION",
    code,
  });
  return res.data;
}

/** Completes a password reset; the API rotates the password and revokes sessions. */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<ConfirmPasswordResetResponse> {
  const res = await apiClient.post("/auth/password-reset/confirm", {
    email,
    code,
    newPassword,
  });
  return res.data;
}
