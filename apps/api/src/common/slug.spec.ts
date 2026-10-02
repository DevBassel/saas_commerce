import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Blue Cotton T-Shirt!')).toBe('blue-cotton-t-shirt');
  });

  it('strips diacritics via NFKD normalization', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-de-ja-vu');
    expect(slugify('Über Größe')).toBe('u-ber-gro-e');
  });

  it('collapses runs of non-alphanumerics into a single hyphen', () => {
    expect(slugify('a___b---c   d')).toBe('a-b-c-d');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Spaced--  ')).toBe('spaced');
    expect(slugify('!!!hello!!!')).toBe('hello');
  });

  it('returns an empty string when there are no alphanumerics', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('truncates to the provided max length', () => {
    expect(slugify('abcdefghij', 4)).toBe('abcd');
    expect(slugify('ab-cdef-gh', 5)).toBe('ab-cd');
  });

  it('defaults to a 200 character limit', () => {
    const result = slugify('a'.repeat(250));
    expect(result).toHaveLength(200);
  });

  it('truncation can leave a trailing hyphen from the cut point', () => {
    expect(slugify('abc def', 4)).toBe('abc-');
  });
});
