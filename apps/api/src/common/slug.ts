/**
 * Lowercases, strips diacritics and collapses any run of non-alphanumeric
 * characters into single hyphens, trimming leading/trailing hyphens. The result
 * is truncated to `maxLength` (default 200).
 */
export const slugify = (value: string, maxLength = 200): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
