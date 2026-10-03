import { fail } from 'k6';

export const MIN_TENANTS = 10;

const DEFAULT_BASE_URL = 'http://localhost:4000/api/v1';

function positiveInt(raw, fallback, name) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) {
    fail(`${name} must be a positive integer, got "${raw}".`);
  }
  return value;
}

function parseWeights(raw, tenantCount) {
  if (raw === undefined || raw === null || !raw.trim()) return null;
  const weights = raw.split(',').map((value) => Number.parseInt(value.trim(), 10));
  if (weights.length !== tenantCount) {
    fail(`K6_TENANT_WEIGHTS must have one entry per tenant (${tenantCount}).`);
  }
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 1)) {
    fail('K6_TENANT_WEIGHTS entries must be integers >= 1.');
  }
  return weights;
}

export function loadConfig(env) {
  const baseUrl = (env.K6_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

  const tenants = (env.K6_TENANTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (tenants.length < MIN_TENANTS) {
    fail(
      [
        'K6 requires at least 10 tenants.',
        `Configured tenants: ${tenants.length}`,
        `Minimum required: ${MIN_TENANTS}`,
      ].join('\n'),
    );
  }

  const seen = {};
  for (const slug of tenants) {
    if (seen[slug]) {
      fail(`K6_TENANTS contains duplicate slug: ${slug}`);
    }
    seen[slug] = true;
  }

  const usersPerTenant = positiveInt(
    env.K6_USERS_PER_TENANT,
    20,
    'K6_USERS_PER_TENANT',
  );
  const productsPerTenant = positiveInt(
    env.K6_PRODUCTS_PER_TENANT,
    10,
    'K6_PRODUCTS_PER_TENANT',
  );
  const password = env.K6_PASSWORD || 'LoadTest1234';
  if (password.length < 8 || password.length > 16) {
    fail('K6_PASSWORD must be 8-16 characters (API DTO rule).');
  }

  const weights = parseWeights(env.K6_TENANT_WEIGHTS, tenants.length);

  return {
    baseUrl,
    tenants,
    weights,
    usersPerTenant,
    productsPerTenant,
    password,
    dataFile: env.K6_DATA_FILE || 'data/dataset.json',
    resultsDir: env.K6_RESULTS_DIR || 'results',
    // Do NOT use K6_VUS / K6_DURATION: those names are reserved by k6 itself
    // and replace the script scenarios with a "default" executor, breaking
    // main.js (no default export).
    vus: positiveInt(env.K6_LOAD_VUS, 1000, 'K6_LOAD_VUS'),
    duration: env.K6_LOAD_DURATION || '2m',
  };
}

// Expand tenants by weight into a slot list. Every tenant appears at least
// once, so the first `expanded.length` virtual users always cover all tenants.
export function buildSlots(tenants, weights) {
  if (!weights) return tenants.slice();
  const slots = [];
  for (let index = 0; index < tenants.length; index += 1) {
    for (let count = 0; count < weights[index]; count += 1) {
      slots.push(tenants[index]);
    }
  }
  return slots;
}

export function tenantForVu(slots, vu) {
  return slots[(vu - 1) % slots.length];
}

export function userIndexForVu(slots, vu, usersPerTenant) {
  const round = Math.floor((vu - 1) / slots.length);
  return (round % usersPerTenant) + 1;
}
