import { config } from './lib/dataset.js';
import { isolation } from './lib/flows.js';
import { buildSummary, renderSummary } from './lib/metrics.js';

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  scenarios: {
    tenant_isolation: {
      executor: 'per-vu-iterations',
      exec: 'isolation',
      vus: config.tenants.length,
      iterations: 5,
      maxDuration: '2m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    tenant_isolation_failures: ['count==0'],
  },
};

export { isolation };

export function handleSummary(data) {
  const summary = buildSummary(data, config);
  const rendered = renderSummary(summary);
  const out = {};
  out.stdout = `\n${rendered}`;
  out[`${config.resultsDir}/isolation-summary.json`] = JSON.stringify(
    summary,
    null,
    2,
  );
  return out;
}
