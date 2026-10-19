import { Counter, Trend } from 'k6/metrics';

export const tenantReqDuration = new Trend('tenant_req_duration', true);
export const tenantRequests = new Counter('tenant_requests');
export const tenantErrors = new Counter('tenant_errors');
export const tenantIsolationFailures = new Counter('tenant_isolation_failures');
export const cacheHits = new Counter('cache_hits');
export const cacheMisses = new Counter('cache_misses');
export const cacheBypasses = new Counter('cache_bypasses');

export function recordRequest(tenant, response, options) {
  const opts = options || {};
  tenantRequests.add(1, { tenant });
  tenantReqDuration.add(response.timings.duration, { tenant });
  if (!opts.ignoreError && response.status >= 400) {
    tenantErrors.add(1, { tenant, status: String(response.status) });
  }

  const cacheStatus =
    response.headers['X-Cache'] || response.headers['x-cache'] || '';
  if (cacheStatus === 'HIT') cacheHits.add(1, { tenant });
  else if (cacheStatus === 'MISS') cacheMisses.add(1, { tenant });
  else if (cacheStatus === 'BYPASS') cacheBypasses.add(1, { tenant });
}

export function recordIsolationFailure(tenant, detail) {
  tenantIsolationFailures.add(1, { tenant, detail });
}

const GLOBAL_DEFAULTS = {
  p50: 0,
  p95: 0,
  p99: 0,
  count: 0,
};

function valuesOf(metrics, name, fallback) {
  const metric = metrics ? metrics[name] : undefined;
  return metric && metric.values ? metric.values : fallback;
}

function tenantMetricMap(metrics, baseName) {
  const result = {};
  for (const key of Object.keys(metrics)) {
    if (key.indexOf(baseName + '{') !== 0) continue;
    const tenant = parseTag(key, 'tenant');
    if (tenant) result[tenant] = metrics[key].values || {};
  }
  return result;
}

function parseTag(key, tag) {
  const marker = tag + ':';
  const start = key.indexOf(marker);
  if (start === -1) return null;
  const value = key.slice(start + marker.length).replace(/[},].*$/, '');
  return value.trim() || null;
}

export function buildSummary(data, config) {
  const metrics = data.metrics || {};
  const httpDuration = valuesOf(metrics, 'http_req_duration', GLOBAL_DEFAULTS);
  const httpFailed = valuesOf(metrics, 'http_req_failed', { rate: 0 });
  const httpReqs = valuesOf(metrics, 'http_reqs', { count: 0 });
  const hits = valuesOf(metrics, 'cache_hits', { count: 0 });
  const misses = valuesOf(metrics, 'cache_misses', { count: 0 });
  const bypasses = valuesOf(metrics, 'cache_bypasses', { count: 0 });

  const durations = tenantMetricMap(metrics, 'tenant_req_duration');
  const requests = tenantMetricMap(metrics, 'tenant_requests');
  const errors = tenantMetricMap(metrics, 'tenant_errors');
  const isolation = tenantMetricMap(metrics, 'tenant_isolation_failures');

  const durationSeconds = data.state
    ? (data.state.testRunDurationMs || 0) / 1000
    : 0;

  const perTenant = {};
  for (const tenant of config.tenants) {
    const duration = durations[tenant] || GLOBAL_DEFAULTS;
    perTenant[tenant] = {
      requests: (requests[tenant] && requests[tenant].count) || 0,
      errors: (errors[tenant] && errors[tenant].count) || 0,
      isolationFailures:
        (isolation[tenant] && isolation[tenant].count) || 0,
      p50: duration['p(50)'] || 0,
      p95: duration['p(95)'] || 0,
      p99: duration['p(99)'] || 0,
      max: duration.max || 0,
      rps:
        durationSeconds > 0
          ? ((requests[tenant] && requests[tenant].count) || 0) / durationSeconds
          : 0,
    };
  }

  const overall = {
    p50: httpDuration['p(50)'] || 0,
    p95: httpDuration['p(95)'] || 0,
    p99: httpDuration['p(99)'] || 0,
    errorRate: httpFailed.rate || 0,
    requests: httpReqs.count || 0,
    rps: durationSeconds > 0 ? (httpReqs.count || 0) / durationSeconds : 0,
    cache: {
      hits: hits.count || 0,
      misses: misses.count || 0,
      bypasses: bypasses.count || 0,
      hitRatio:
        (hits.count || 0) + (misses.count || 0) > 0
          ? (hits.count || 0) / ((hits.count || 0) + (misses.count || 0))
          : 0,
    },
  };

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    tenantCount: config.tenants.length,
    overall,
    perTenant,
  };
}

function formatMs(value) {
  return `${Number(value).toFixed(2)}ms`;
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

export function renderSummary(summary) {
  const lines = [];
  lines.push('=== K6 multi-tenant load test summary ===');
  lines.push(`base URL: ${summary.baseUrl}`);
  lines.push(`tenants: ${summary.tenantCount}`);
  lines.push('');
  lines.push('Overall:');
  lines.push(`  p50        ${formatMs(summary.overall.p50)}`);
  lines.push(`  p95        ${formatMs(summary.overall.p95)}`);
  lines.push(`  p99        ${formatMs(summary.overall.p99)}`);
  lines.push(`  error rate ${formatPercent(summary.overall.errorRate)}`);
  lines.push(`  requests   ${summary.overall.requests}`);
  lines.push(`  RPS        ${summary.overall.rps.toFixed(2)}`);
  lines.push(
    `  cache      ${summary.overall.cache.hits} hit / ${summary.overall.cache.misses} miss / ${summary.overall.cache.bypasses} bypass (hit ratio ${formatPercent(summary.overall.cache.hitRatio)})`,
  );
  lines.push('');
  lines.push('Per tenant:');
  lines.push(
    '  tenant        requests    errors    isoFail        p95        p99        RPS',
  );
  for (const tenant of Object.keys(summary.perTenant)) {
    const row = summary.perTenant[tenant];
    lines.push(
      `  ${pad(tenant, 13)}${pad(row.requests, 10)}${pad(row.errors, 10)}${pad(
        row.isolationFailures,
        11,
      )}${pad(formatMs(row.p95), 11)}${pad(formatMs(row.p99), 11)}${row.rps.toFixed(2)}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}
