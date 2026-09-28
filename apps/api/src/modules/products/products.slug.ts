export const slugifyProductName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

const sanitizeSeed = (seed: string): string =>
  seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

export const buildProductSlugBase = (name: string, seed: string): string => {
  const base = slugifyProductName(name);
  if (base) return base;
  const fallback = sanitizeSeed(seed);
  return fallback ? `product-${fallback}` : 'product';
};

export const withSlugSuffix = (base: string, suffix: number): string =>
  suffix <= 1 ? base : `${base}-${suffix}`;

export interface SlugOwner {
  id: number;
}

export const ensureUniqueProductSlug = async (
  findOwner: (slug: string) => Promise<SlugOwner | null>,
  name: string,
  seed: string,
  excludeId?: number,
): Promise<string> => {
  const base = buildProductSlugBase(name, seed);
  let suffix = 1;
  for (;;) {
    const candidate = withSlugSuffix(base, suffix);
    const owner = await findOwner(candidate);
    if (!owner || owner.id === excludeId) return candidate;
    suffix += 1;
  }
};
