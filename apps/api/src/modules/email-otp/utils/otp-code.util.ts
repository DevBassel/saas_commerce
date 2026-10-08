import { createHmac, randomInt, timingSafeEqual } from 'crypto';

/**
 * Generates a zero-padded numeric code of the requested length using a
 * cryptographically secure source.
 */
export const generateOtpCode = (length: number): string => {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
};

/**
 * Peppered HMAC of `challengeId:code`. The challenge id is part of the message
 * so the same code hashes differently across challenges, and the pepper lives
 * in the environment (not the database).
 */
export const hashOtpCode = (
  secret: string,
  challengeId: string,
  code: string,
): string =>
  createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');

/** Constant-time comparison of a candidate code against a stored hash. */
export const verifyOtpCode = (
  secret: string,
  challengeId: string,
  code: string,
  expectedHash: string,
): boolean => {
  const actual = Buffer.from(hashOtpCode(secret, challengeId, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};
