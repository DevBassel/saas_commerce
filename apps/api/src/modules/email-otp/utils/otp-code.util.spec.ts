import { generateOtpCode, hashOtpCode, verifyOtpCode } from './otp-code.util';

const SECRET = `otp_${'a'.repeat(40)}`;

describe('generateOtpCode', () => {
  it('generates a zero-padded code of the requested length', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateOtpCode(6);
      expect(code).toMatch(/^[0-9]{6}$/);
    }
  });

  it('can produce leading zeros', () => {
    const codes = Array.from({ length: 200 }, () => generateOtpCode(2));
    expect(codes.some((code) => code.startsWith('0'))).toBe(true);
  });

  it('is not constant', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtpCode(6)));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('hashOtpCode', () => {
  it('is deterministic for the same (id, code)', () => {
    expect(hashOtpCode(SECRET, 'id-1', '123456')).toBe(
      hashOtpCode(SECRET, 'id-1', '123456'),
    );
  });

  it('differs across challenge ids for the same code', () => {
    expect(hashOtpCode(SECRET, 'id-1', '123456')).not.toBe(
      hashOtpCode(SECRET, 'id-2', '123456'),
    );
  });

  it('differs across codes for the same id', () => {
    expect(hashOtpCode(SECRET, 'id-1', '123456')).not.toBe(
      hashOtpCode(SECRET, 'id-1', '123457'),
    );
  });

  it('is a 64-char hex digest', () => {
    expect(hashOtpCode(SECRET, 'id-1', '123456')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyOtpCode', () => {
  it('accepts the matching code', () => {
    const hash = hashOtpCode(SECRET, 'id-1', '123456');
    expect(verifyOtpCode(SECRET, 'id-1', '123456', hash)).toBe(true);
  });

  it('rejects a wrong code', () => {
    const hash = hashOtpCode(SECRET, 'id-1', '123456');
    expect(verifyOtpCode(SECRET, 'id-1', '654321', hash)).toBe(false);
  });

  it('rejects a code verified against another challenge id', () => {
    const hash = hashOtpCode(SECRET, 'id-1', '123456');
    expect(verifyOtpCode(SECRET, 'id-2', '123456', hash)).toBe(false);
  });

  it('rejects a malformed hash without throwing', () => {
    expect(verifyOtpCode(SECRET, 'id-1', '123456', 'not-hex')).toBe(false);
  });
});
