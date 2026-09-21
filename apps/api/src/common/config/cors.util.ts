const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export type CorsOriginDelegate = (
  requestOrigin: string | undefined,
  callback: (err: Error | null, allow: boolean) => void,
) => void;

export const hostnameFromOrigin = (origin: string): string | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return undefined;
  }
  if (!HTTP_PROTOCOLS.has(parsed.protocol)) return undefined;
  return parsed.hostname.toLowerCase() || undefined;
};

export const normalizeRootDomain = (
  rootDomain?: string,
): string | undefined => {
  if (!rootDomain) return undefined;
  const root = rootDomain.trim().toLowerCase().replace(/^\.+/, '');
  return root.length > 0 ? root : undefined;
};

export const isRootDomainOrigin = (
  origin: string,
  rootDomain?: string,
): boolean => {
  const root = normalizeRootDomain(rootDomain);
  if (!root) return false;
  const hostname = hostnameFromOrigin(origin);
  if (!hostname) return false;
  return hostname === root || hostname.endsWith(`.${root}`);
};

export const buildCorsOrigin = (
  rawOrigins: string,
  rootDomain?: string,
): CorsOriginDelegate => {
  const allowed = new Set(
    rawOrigins
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );

  return (requestOrigin, callback) => {
    if (!requestOrigin) {
      callback(null, true);
      return;
    }
    const origin = requestOrigin.trim().toLowerCase();
    if (allowed.has(origin) || isRootDomainOrigin(origin, rootDomain)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
};
