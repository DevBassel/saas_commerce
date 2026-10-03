import { config } from './lib/dataset.js';
import { browse, cartFlow, checkoutFlow, isolation } from './lib/flows.js';
import { buildSummary, renderSummary } from './lib/metrics.js';

const cartVus = Math.max(1, Math.floor(config.vus / 2));
const checkoutVus = Math.max(1, Math.floor(config.vus / 5));

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  scenarios: {
    browse: {
      executor: 'constant-vus',
      exec: 'browse',
      vus: config.vus,
      duration: config.duration,
      gracefulStop: '10s',
    },
    cart_flow: {
      executor: 'constant-vus',
      exec: 'cartFlow',
      vus: cartVus,
      duration: config.duration,
      gracefulStop: '15s',
    },
    checkout_flow: {
      executor: 'constant-vus',
      exec: 'checkoutFlow',
      vus: checkoutVus,
      duration: config.duration,
      gracefulStop: '20s',
    },
    tenant_isolation: {
      executor: 'per-vu-iterations',
      exec: 'isolation',
      vus: config.tenants.length,
      iterations: 3,
      maxDuration: '2m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2500'],
    tenant_isolation_failures: ['count==0'],
  },
};

export { browse, cartFlow, checkoutFlow, isolation };

export function handleSummary(data) {
  const summary = buildSummary(data, config);
  const rendered = renderSummary(summary);

  const out = {};
  out.stdout = `\n${rendered}`;
  out[`${config.resultsDir}/summary.json`] = JSON.stringify(summary, null, 2);
  out[`${config.resultsDir}/summary.txt`] = rendered;
  return out;
}
