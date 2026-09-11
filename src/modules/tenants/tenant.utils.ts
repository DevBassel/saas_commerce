export type TenantRef = { schemaName: string };

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'must be lowercase alphanumeric, hyphen-separated';

export const sanitizeSchemaName = (name: string): string => {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 63);
  if (!sanitized) throw new Error('Invalid schema name');
  return sanitized;
};

export const buildSchemaName = (slug: string): string =>
  sanitizeSchemaName(`tenant_${slug}`);

export const resolveSubdomain = (
  host: string | undefined,
  rootDomain: string | undefined,
): string | undefined => {
  if (!host || !rootDomain) return undefined;
  const hostname = host.replace(/:\d+$/, '').toLowerCase();
  const root = rootDomain.toLowerCase();
  if (hostname === root) return undefined;
  if (hostname.endsWith(`.${root}`)) {
    const candidate = hostname.slice(0, -(root.length + 1));
    return candidate.length > 0 ? candidate : undefined;
  }
  return undefined;
};
