import { round2, toMajorUnit, toMinorUnit } from './money';

describe('money helpers', () => {
  describe('round2', () => {
    it('rounds to two decimal places', () => {
      expect(round2(10.005)).toBe(10.01);
      expect(round2(10.004)).toBe(10);
      expect(round2(1.115)).toBe(1.12);
      expect(round2(2.675)).toBe(2.68);
    });

    it('leaves already-rounded values unchanged', () => {
      expect(round2(19.99)).toBe(19.99);
      expect(round2(0)).toBe(0);
    });

    it('rounds negative midpoints toward zero (Math.round semantics)', () => {
      expect(round2(-2.675)).toBe(-2.67);
      expect(round2(-1.005)).toBe(-1);
      expect(round2(-19.99)).toBe(-19.99);
    });
  });

  describe('toMinorUnit', () => {
    it('converts major units to cents', () => {
      expect(toMinorUnit(10)).toBe(1000);
      expect(toMinorUnit(19.99)).toBe(1999);
      expect(toMinorUnit(0.01)).toBe(1);
    });

    it('rounds floating-point noise instead of truncating', () => {
      expect(toMinorUnit(0.1 + 0.2)).toBe(30);
      expect(toMinorUnit(1.005)).toBe(100);
    });

    it('handles zero', () => {
      expect(toMinorUnit(0)).toBe(0);
    });
  });

  describe('toMajorUnit', () => {
    it('converts cents to major units', () => {
      expect(toMajorUnit(1999)).toBe(19.99);
      expect(toMajorUnit(1000)).toBe(10);
      expect(toMajorUnit(1)).toBe(0.01);
      expect(toMajorUnit(0)).toBe(0);
    });
  });

  it('round-trips through both units', () => {
    for (const amount of [0, 0.01, 9.99, 100, 1234.56]) {
      expect(toMajorUnit(toMinorUnit(amount))).toBeCloseTo(amount, 2);
    }
  });
});
