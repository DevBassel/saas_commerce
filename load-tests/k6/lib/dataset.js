import { fail } from 'k6';
import { buildSlots, loadConfig, tenantForVu, userIndexForVu } from '../config.js';

export const config = loadConfig(__ENV);
export const slots = buildSlots(config.tenants, config.weights);

const raw = (function readDataset() {
  try {
    return open(config.dataFile);
  } catch (err) {
    fail(
      `Cannot open dataset "${config.dataFile}". Run the seed script first: ` +
        `npx ts-node -r tsconfig-paths/register test/seed-load-test.ts (from apps/api).`,
    );
    return '';
  }
})();
const parsed = JSON.parse(raw);

if (!parsed || !Array.isArray(parsed.tenants)) {
  fail(`Dataset ${config.dataFile} is invalid: expected a tenants array.`);
}
if (parsed.password !== config.password) {
  fail(
    `Dataset password does not match K6_PASSWORD. Re-run the seed script or fix the env.`,
  );
}

export const dataFile = config.dataFile;
export const dataset = parsed;
export const tenantsBySlug = {};

for (const record of parsed.tenants) {
  tenantsBySlug[record.slug] = record;
}

for (const slug of config.tenants) {
  const record = tenantsBySlug[slug];
  if (!record) {
    fail(
      `Configured tenant "${slug}" is missing from ${config.dataFile}. Run the seed script.`,
    );
  }
  if (!Array.isArray(record.users) || record.users.length === 0) {
    fail(`Tenant "${slug}" has no seeded users in ${config.dataFile}.`);
  }
  if (!Array.isArray(record.products) || record.products.length === 0) {
    fail(`Tenant "${slug}" has no seeded products in ${config.dataFile}.`);
  }
}

export function assignmentForVu(vu) {
  const slug = tenantForVu(slots, vu);
  const userIndex = userIndexForVu(slots, vu, config.usersPerTenant);
  const record = tenantsBySlug[slug];
  const user = record.users[(userIndex - 1) % record.users.length];
  return {
    slug,
    schemaName: record.schemaName,
    email: user.email,
    products: record.products,
  };
}

export function otherTenantSlug(slug) {
  const index = config.tenants.indexOf(slug);
  return config.tenants[(index + 1) % config.tenants.length];
}
