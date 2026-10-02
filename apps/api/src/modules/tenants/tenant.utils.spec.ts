import {
  buildSchemaName,
  resolveSubdomain,
  sanitizeSchemaName,
} from './tenant.utils';

describe('resolveSubdomain', () => {
  const root = 'example.com';

  it('returns undefined without a host or root domain', () => {
    expect(resolveSubdomain(undefined, root)).toBeUndefined();
    expect(resolveSubdomain('shop.example.com', undefined)).toBeUndefined();
  });

  it('returns undefined for the apex host', () => {
    expect(resolveSubdomain('example.com', root)).toBeUndefined();
  });

  it('returns the subdomain for a matching host', () => {
    expect(resolveSubdomain('my-store.example.com', root)).toBe('my-store');
  });

  it('returns nested subdomains unchanged', () => {
    expect(resolveSubdomain('a.b.example.com', root)).toBe('a.b');
  });

  it('strips the port before matching', () => {
    expect(resolveSubdomain('my-store.example.com:5174', root)).toBe(
      'my-store',
    );
  });

  it('is case-insensitive for host and root domain', () => {
    expect(resolveSubdomain('My-Store.EXAMPLE.com', 'Example.COM')).toBe(
      'my-store',
    );
  });

  it('returns undefined for non-matching hosts', () => {
    expect(resolveSubdomain('my-store.example.org', root)).toBeUndefined();
    expect(resolveSubdomain('example.com.evil.com', root)).toBeUndefined();
  });

  it('returns undefined when the host is only the root with a leading dot', () => {
    expect(resolveSubdomain('.example.com', root)).toBeUndefined();
  });
});

describe('sanitizeSchemaName', () => {
  it('lowercases and replaces disallowed characters with underscores', () => {
    expect(sanitizeSchemaName('Tenant-My.Store')).toBe('tenant_my_store');
  });

  it('keeps letters, digits and underscores', () => {
    expect(sanitizeSchemaName('tenant_ab12')).toBe('tenant_ab12');
  });

  it('truncates to the 63-char Postgres identifier limit', () => {
    const result = sanitizeSchemaName('a'.repeat(80));
    expect(result).toHaveLength(63);
  });

  it('throws for an empty name', () => {
    expect(() => sanitizeSchemaName('')).toThrow('Invalid schema name');
  });
});

describe('buildSchemaName', () => {
  it('prefixes and sanitizes the slug', () => {
    expect(buildSchemaName('my-store')).toBe('tenant_my_store');
    expect(buildSchemaName('My Store')).toBe('tenant_my_store');
  });

  it('never exceeds the 63-char limit even with a long slug', () => {
    expect(buildSchemaName('x'.repeat(100))).toHaveLength(63);
  });
});
