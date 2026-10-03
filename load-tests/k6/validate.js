import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';
import { config, tenantsBySlug } from './lib/dataset.js';
import { authFor, request } from './lib/api.js';

const validationFailures = new Counter('validation_failures');

export const options = {
  scenarios: {
    validate: {
      executor: 'per-vu-iterations',
      exec: 'validateTenant',
      vus: config.tenants.length,
      iterations: 1,
      maxDuration: '10m',
      gracefulStop: '5s',
    },
  },
  thresholds: {
    validation_failures: ['count==0'],
  },
};

function reportFailure(tenant, message) {
  validationFailures.add(1, { tenant });
  console.error(`[validate] tenant ${tenant}: ${message}`);
}

export function validateTenant() {
  const slug = config.tenants[(__VU - 1) % config.tenants.length];
  const record = tenantsBySlug[slug];

  const info = request('GET', '/store/info', { tenant: slug });
  let infoOk = false;
  try {
    const body = info.json();
    infoOk = info.status === 200 && body && body.slug === slug;
  } catch (err) {
    infoOk = false;
  }
  if (!infoOk) reportFailure(slug, 'store/info did not resolve the tenant');

  const list = request('GET', '/products', { tenant: slug });
  let productCount = 0;
  try {
    const body = list.json();
    productCount = Array.isArray(body) ? body.length : 0;
  } catch (err) {
    productCount = 0;
  }
  if (list.status !== 200 || productCount === 0) {
    reportFailure(slug, 'no products returned for tenant');
  }

  let authenticated = 0;
  for (const user of record.users) {
    const token = authFor(slug, user.email);
    if (!token) {
      reportFailure(slug, `login failed for ${user.email}`);
      continue;
    }
    const cart = request('GET', '/cart', { tenant: slug, token });
    if (cart.status === 200) {
      authenticated += 1;
    } else {
      reportFailure(
        slug,
        `${user.email} token rejected on own tenant (${cart.status})`,
      );
    }
  }

  const firstUser = record.users[0];
  const firstToken = authFor(slug, firstUser.email);
  const other = config.tenants[(config.tenants.indexOf(slug) + 1) % config.tenants.length];
  if (firstToken) {
    const cross = request('GET', '/cart', {
      tenant: other,
      token: firstToken,
      expectedFailure: true,
      extraTags: { expected_response: 'true' },
    });
    if (cross.status !== 403) {
      reportFailure(
        slug,
        `tenant isolation broken: token accepted under ${other} (${cross.status})`,
      );
    }
  }

  check(authenticated === record.users.length, {
    'tenant authenticated all users': (value) => value === true,
  });

  if (authenticated !== record.users.length) {
    fail(`K6 validation failed for tenant ${slug}.`);
  }
}

export function handleSummary(data) {
  const failures = data.metrics.validation_failures;
  const count = failures && failures.values ? failures.values.count : 0;
  return {
    stdout: `\nK6 validation failures: ${count}\n`,
  };
}
