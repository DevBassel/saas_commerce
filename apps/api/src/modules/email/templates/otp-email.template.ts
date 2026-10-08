export interface OtpEmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface OtpEmailParams {
  code: string;
  purpose: string;
  expiresInSeconds: number;
  displayName: string;
}

const PURPOSE_LABELS: Record<string, string> = {
  EMAIL_VERIFICATION: 'verify your email address',
  PASSWORD_RESET: 'reset your password',
  LOGIN_MFA: 'finish signing in',
  SENSITIVE_ACTION: 'confirm a sensitive action',
};

const purposeLabel = (purpose: string): string =>
  PURPOSE_LABELS[purpose] ?? 'confirm your identity';

const formatExpiry = (seconds: number): string => {
  if (seconds % 60 === 0 && seconds >= 60) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
};

export const buildOtpEmail = ({
  code,
  purpose,
  expiresInSeconds,
  displayName,
}: OtpEmailParams): OtpEmailContent => {
  const action = purposeLabel(purpose);
  const expiry = formatExpiry(expiresInSeconds);
  const subject = `Your ${displayName} code to ${action}`;

  const text = [
    `Your ${displayName} verification code is: ${code}`,
    '',
    `Use it to ${action}. The code expires in ${expiry}.`,
    '',
    'If you did not request this, ignore this email and consider changing your password.',
  ].join('\n');

  const html = [
    `<p>Your ${displayName} verification code is:</p>`,
    `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>`,
    `<p>Use it to ${action}. The code expires in ${expiry}.</p>`,
    `<p style="color:#666">If you did not request this, ignore this email and consider changing your password.</p>`,
  ].join('\n');

  return { subject, text, html };
};
