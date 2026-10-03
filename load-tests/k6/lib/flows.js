import { check, sleep } from 'k6';
import {
  assignmentForVu,
  otherTenantSlug,
} from './dataset.js';
import { authFor, request } from './api.js';
import { recordIsolationFailure } from './metrics.js';

function productForIteration(products, iter) {
  return products[iter % products.length];
}

export function browse() {
  const assignment = assignmentForVu(__VU);
  const slug = assignment.slug;

  const info = request('GET', '/store/info', { tenant: slug });
  check(info, {
    'store/info 200': (res) => res.status === 200,
    'store/info tenant matches': (res) => {
      let body = null;
      try {
        body = res.json();
      } catch (err) {
        return false;
      }
      return !!body && body.slug === slug;
    },
  });

  const list = request('GET', '/products', { tenant: slug });
  check(list, {
    'products list 200': (res) => res.status === 200,
    'products list is array': (res) => {
      let body = null;
      try {
        body = res.json();
      } catch (err) {
        return false;
      }
      return Array.isArray(body) && body.length > 0;
    },
  });

  const product = productForIteration(assignment.products, __ITER);
  const one = request('GET', `/products/${product.id}`, { tenant: slug });
  check(one, {
    'product detail 200': (res) => res.status === 200,
    'product detail matches tenant catalog': (res) => {
      let body = null;
      try {
        body = res.json();
      } catch (err) {
        return false;
      }
      return !!body && body.id === product.id;
    },
  });

  sleep(1);
}

export function cartFlow() {
  const assignment = assignmentForVu(__VU);
  const slug = assignment.slug;
  const token = authFor(slug, assignment.email);
  if (!token) {
    check(false, { 'login succeeded': () => false });
    return;
  }

  const product = productForIteration(assignment.products, __ITER);

  const before = request('GET', '/cart', { tenant: slug, token });
  check(before, { 'get cart 200': (res) => res.status === 200 });

  const added = request('POST', '/cart/items', {
    tenant: slug,
    token,
    body: { productId: product.id, quantity: 1 },
  });
  check(added, { 'add cart item 201': (res) => res.status === 201 });

  const updated = request('PATCH', `/cart/items/${product.id}`, {
    tenant: slug,
    token,
    body: { quantity: 2 },
  });
  check(updated, { 'update cart item 200': (res) => res.status === 200 });

  const removed = request('DELETE', `/cart/items/${product.id}`, {
    tenant: slug,
    token,
  });
  check(removed, { 'remove cart item 200': (res) => res.status === 200 });

  sleep(1);
}

export function checkoutFlow() {
  const assignment = assignmentForVu(__VU);
  const slug = assignment.slug;
  const token = authFor(slug, assignment.email);
  if (!token) {
    check(false, { 'login succeeded': () => false });
    return;
  }

  const product = productForIteration(assignment.products, __ITER);

  request('DELETE', '/cart', { tenant: slug, token });

  const added = request('POST', '/cart/items', {
    tenant: slug,
    token,
    body: { productId: product.id, quantity: 1 },
  });
  check(added, { 'checkout add cart item 201': (res) => res.status === 201 });

  const order = request('POST', '/orders', { tenant: slug, token, body: {} });
  check(order, {
    'checkout 201': (res) => res.status === 201,
    'checkout has order number': (res) => {
      let body = null;
      try {
        body = res.json();
      } catch (err) {
        return false;
      }
      return !!body && typeof body.orderNumber === 'string';
    },
  });

  sleep(1);
}

// Safe, non-destructive isolation checks. A token minted for tenant A must be
// rejected when sent under tenant B's context (403), while a request that
// keeps the tenant context aligned with the token succeeds.
export function isolation() {
  const assignment = assignmentForVu(__VU);
  const own = assignment.slug;
  const other = otherTenantSlug(own);
  const token = authFor(own, assignment.email);

  if (!token) {
    recordIsolationFailure(own, 'login failed');
    check(false, { 'isolation login succeeded': () => false });
    return;
  }

  const ownInfo = request('GET', '/store/info', { tenant: own });
  const otherInfo = request('GET', '/store/info', { tenant: other });
  const ownCart = request('GET', '/cart', { tenant: own, token });
  const crossCart = request('GET', '/cart', {
    tenant: other,
    token,
    expectedFailure: true,
    extraTags: { expected_response: 'true' },
  });

  const infoOk = check(ownInfo, {
    'own tenant info matches': (res) => {
      let body = null;
      try {
        body = res.json();
      } catch (err) {
        return false;
      }
      return res.status === 200 && !!body && body.slug === own;
    },
  });
  if (!infoOk) recordIsolationFailure(own, 'store/info did not return own slug');

  const otherInfoOk = check(otherInfo, {
    'other tenant info matches': (res) => {
      let body = null;
      try {
        body = res.json();
      } catch (err) {
        return false;
      }
      return res.status === 200 && !!body && body.slug === other;
    },
  });
  if (!otherInfoOk) recordIsolationFailure(own, 'store/info leaked wrong tenant');

  const ownCartOk = check(ownCart, {
    'own cart reachable': (res) => res.status === 200,
  });
  if (!ownCartOk) recordIsolationFailure(own, 'own cart not reachable');

  const crossCartOk = check(crossCart, {
    'cross-tenant token rejected': (res) => res.status === 403,
  });
  if (!crossCartOk) {
    recordIsolationFailure(
      own,
      `cross-tenant token returned ${crossCart.status}, expected 403`,
    );
  }

  sleep(1);
}
