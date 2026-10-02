import {
  buildCorsOrigin,
  hostnameFromOrigin,
  isRootDomainOrigin,
  normalizeRootDomain,
} from './cors.util';

type Delegate = ReturnType<typeof buildCorsOrigin>;

const callDelegate = (
  delegate: Delegate,
  origin: string | undefined,
): jest.Mock => {
  const callback = jest.fn();
  delegate(origin, callback);
  return callback;
};

describe('hostnameFromOrigin', () => {
  it('returns undefined for an unparsable origin', () => {
    expect(hostnameFromOrigin('not a url')).toBeUndefined();
  });

  it('returns undefined for a non-http(s) protocol', () => {
    expect(hostnameFromOrigin('ftp://example.com')).toBeUndefined();
    expect(hostnameFromOrigin('mailto:admin@example.com')).toBeUndefined();
  });

  it('returns the lowercase hostname and drops the port', () => {
    expect(hostnameFromOrigin('HTTP://Example.COM:3000')).toBe('example.com');
    expect(hostnameFromOrigin('https://my-store.localhost:5174')).toBe(
      'my-store.localhost',
    );
  });
});

describe('normalizeRootDomain', () => {
  it('returns undefined for empty input', () => {
    expect(normalizeRootDomain(undefined)).toBeUndefined();
    expect(normalizeRootDomain('')).toBeUndefined();
  });

  it('strips leading dots, lowercases and trims', () => {
    expect(normalizeRootDomain('  .Example.COM.  ')).toBe('example.com.');
    expect(normalizeRootDomain('...localhost')).toBe('localhost');
  });

  it('returns undefined when only dots remain', () => {
    expect(normalizeRootDomain('...')).toBeUndefined();
  });
});

describe('isRootDomainOrigin', () => {
  it('matches the apex domain', () => {
    expect(isRootDomainOrigin('https://example.com', 'example.com')).toBe(true);
  });

  it('matches any subdomain, including nested ones', () => {
    expect(
      isRootDomainOrigin('https://my-store.example.com', 'example.com'),
    ).toBe(true);
    expect(isRootDomainOrigin('https://a.b.example.com', 'example.com')).toBe(
      true,
    );
  });

  it('is case-insensitive and ignores an origin port', () => {
    expect(
      isRootDomainOrigin('HTTPS://My-Store.Example.COM:5174', 'Example.com'),
    ).toBe(true);
  });

  it('rejects unrelated, suffix-spoofed and invalid origins', () => {
    expect(isRootDomainOrigin('https://evil.com', 'example.com')).toBe(false);
    expect(isRootDomainOrigin('https://notexample.com', 'example.com')).toBe(
      false,
    );
    expect(isRootDomainOrigin('not a url', 'example.com')).toBe(false);
  });

  it('returns false without a root domain', () => {
    expect(isRootDomainOrigin('https://example.com', undefined)).toBe(false);
    expect(isRootDomainOrigin('https://example.com', '')).toBe(false);
  });
});

describe('buildCorsOrigin', () => {
  it('allows an exact allowlist entry', () => {
    const delegate = buildCorsOrigin('https://dash.example.com');

    expect(
      callDelegate(delegate, 'https://dash.example.com'),
    ).toHaveBeenCalledWith(null, true);
  });

  it('allows root-domain and subdomain origins through the delegate', () => {
    const delegate = buildCorsOrigin('https://dash.example.com', 'localhost');

    expect(
      callDelegate(delegate, 'https://my-store.localhost:5174'),
    ).toHaveBeenCalledWith(null, true);
    expect(
      callDelegate(delegate, 'http://localhost:3000'),
    ).toHaveBeenCalledWith(null, true);
  });

  it('allows a missing origin (server-to-server / same-origin)', () => {
    const delegate = buildCorsOrigin('https://dash.example.com');

    expect(callDelegate(delegate, undefined)).toHaveBeenCalledWith(null, true);
  });

  it('denies an unknown origin', () => {
    const delegate = buildCorsOrigin('https://dash.example.com', 'example.com');

    expect(callDelegate(delegate, 'https://evil.com')).toHaveBeenCalledWith(
      null,
      false,
    );
  });

  it('is whitespace- and case-insensitive on both sides', () => {
    const delegate = buildCorsOrigin('  HTTPS://Dash.Example.COM ,  ');

    expect(
      callDelegate(delegate, ' https://dash.example.com '),
    ).toHaveBeenCalledWith(null, true);
  });

  it('filters out empty allowlist entries', () => {
    const delegate = buildCorsOrigin(' , ,https://dash.example.com,');

    expect(
      callDelegate(delegate, 'https://dash.example.com'),
    ).toHaveBeenCalledWith(null, true);
    expect(callDelegate(delegate, 'https://evil.com')).toHaveBeenCalledWith(
      null,
      false,
    );
  });

  it('denies every origin when the allowlist is empty', () => {
    const delegate = buildCorsOrigin(' , ');

    expect(
      callDelegate(delegate, 'https://dash.example.com'),
    ).toHaveBeenCalledWith(null, false);
  });
});
