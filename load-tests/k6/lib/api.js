import http from 'k6/http';
import { config } from './dataset.js';
import { recordRequest } from './metrics.js';

const jsonHeaders = { 'content-type': 'application/json' };

export function request(method, path, options) {
  const opts = options || {};
  const headers = Object.assign({ accept: 'application/json' }, opts.headers);
  if (opts.tenant) headers['x-tenant-slug'] = opts.tenant;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  let body = null;
  if (opts.body !== undefined) {
    Object.assign(headers, jsonHeaders);
    body = JSON.stringify(opts.body);
  }

  const params = {
    headers,
    tags: Object.assign(
      opts.tenant ? { tenant: opts.tenant } : {},
      opts.extraTags || {},
    ),
  };

  const response = http.request(
    method,
    `${config.baseUrl}${path}`,
    body,
    params,
  );
  recordRequest(opts.tenant || 'unknown', response, {
    ignoreError: opts.expectedFailure,
  });
  return response;
}

// Per-VU token cache. Module scope is isolated per virtual user, so each VU
// authenticates once and reuses its token for the rest of the run.
const authCache = {};

export function authFor(slug, email) {
  if (authCache[slug]) return authCache[slug];

  const response = request('POST', '/auth/login', {
    tenant: slug,
    body: { email, password: config.password },
  });

  if (response.status !== 200) return null;
  const token = response.json('access_token');
  if (!token) return null;
  authCache[slug] = token;
  return token;
}
