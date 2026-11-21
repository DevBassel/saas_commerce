import sharp from 'sharp';
import { DEMO_IMAGES_PER_PRODUCT, DemoProductSeed } from './demo-tenant.data';

const IMAGE_SIZE = 1200;
const IMAGE_VIEWS = ['hero', 'detail', 'lifestyle', 'packaging'] as const;

export interface DemoImageManifestEntry {
  productSlug: string;
  productName: string;
  sourceId: string;
  view: (typeof IMAGE_VIEWS)[number];
  position: number;
  background: string;
  accent: string;
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const buildDemoImageManifest = (
  products: DemoProductSeed[],
): DemoImageManifestEntry[] =>
  products.flatMap((product) =>
    IMAGE_VIEWS.map((view, index) => ({
      productSlug: product.slug,
      productName: product.name,
      sourceId: `generated:${product.slug}:${view}`,
      view,
      position: index + 1,
      background: product.imageBackground,
      accent: product.imageAccent,
    })),
  );

export const validateDemoImageManifest = (
  manifest: DemoImageManifestEntry[],
  products: DemoProductSeed[],
): void => {
  const sourceIds = new Set(manifest.map((image) => image.sourceId));
  if (sourceIds.size !== manifest.length) {
    throw new Error('Demo image manifest contains duplicate sources');
  }

  for (const product of products) {
    const images = manifest.filter(
      (image) => image.productSlug === product.slug,
    );
    if (images.length !== DEMO_IMAGES_PER_PRODUCT) {
      throw new Error(
        `Demo product ${product.slug} requires ${DEMO_IMAGES_PER_PRODUCT} images`,
      );
    }
    const positions = images.map((image) => image.position).sort();
    if (positions.join(',') !== '1,2,3,4') {
      throw new Error(
        `Demo product ${product.slug} has invalid image ordering`,
      );
    }
  }
};

export const renderDemoImage = async (
  image: DemoImageManifestEntry,
): Promise<Buffer> => {
  const name = escapeXml(image.productName);
  const view = escapeXml(image.view.toUpperCase());
  const shift = image.position * 42;
  const svg = `
    <svg width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" viewBox="0 0 ${IMAGE_SIZE} ${IMAGE_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${image.background}" />
          <stop offset="1" stop-color="#09090b" />
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="28" stdDeviation="28" flood-opacity="0.35" /></filter>
      </defs>
      <rect width="1200" height="1200" fill="url(#bg)" />
      <circle cx="${230 + shift}" cy="${250 + shift}" r="190" fill="${image.accent}" opacity="0.18" />
      <rect x="210" y="235" width="780" height="590" rx="88" fill="#ffffff" opacity="0.96" filter="url(#shadow)" />
      <rect x="285" y="315" width="630" height="350" rx="54" fill="${image.accent}" opacity="0.2" />
      <circle cx="600" cy="490" r="${110 + image.position * 14}" fill="${image.accent}" opacity="0.84" />
      <path d="M450 ${540 - shift / 3} L600 365 L750 ${540 + shift / 3} L690 650 L510 650 Z" fill="${image.background}" opacity="0.88" />
      <text x="600" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" letter-spacing="8" fill="${image.background}">${view}</text>
      <text x="600" y="935" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#ffffff">${name}</text>
      <text x="600" y="1000" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" letter-spacing="5" fill="${image.accent}">DEMO CATALOG</text>
    </svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const metadata = await sharp(buffer).metadata();
  if (
    metadata.format !== 'png' ||
    metadata.width !== IMAGE_SIZE ||
    metadata.height !== IMAGE_SIZE
  ) {
    throw new Error(`Generated image ${image.sourceId} is invalid`);
  }
  return buffer;
};
