# Product Context — saas_commerce

Why the project exists and who it serves. Pairs with `projectbrief.md`.

## Problem it solves

Small and mid-size merchants need an online store without operating infrastructure. This
platform gives each merchant an isolated data schema, an admin console to manage catalog,
orders, customers, payments, and storage, and a public storefront on their own subdomain —
all from one deployment.

Platform operators (super admins) need to onboard merchants, gate their access, oversee
payments, and handle currency changes without touching merchant data directly.

## Users and their surfaces

| User | Surface | Primary jobs |
| --- | --- | --- |
| Platform super admin | `super_admin_dash` | Provision tenants, toggle active, review payments/payouts, approve/reject currency requests |
| Store owner / admin | `store_owner_dashboard` | Manage products, categories, orders, staff/customers, payments, store settings |
| Customer | `tenant_store` | Browse catalog, cart, checkout, pay, view/cancel/return orders |
| Machine | API `apps/api` | Enforce tenant isolation, auth, RBAC, quotas, payments |

## Domain model (mental model)

- A **Tenant** lives in the public schema with a unique `slug`/`schemaName`/`subdomain`,
  a `status` (`active`/`inactive`), storage quota, and Stripe Connect fields.
- Each tenant owns a `tenant_<slug>` schema holding its `user`, roles/permissions, products,
  cart, orders, payments, addresses, and coupons. The same email may exist in two tenants.
- Tenant context travels on `x-tenant-slug` (or `x-tenant-id`, or subdomain) and is resolved to
  the schema before guards run.

## UX goals

- Storefront: SEO-oriented, server-rendered catalog, minimal checkout friction.
- Dashboards: consistent Refine + shadcn/ui look (`new-york` style for the dashboards,
  `base-rhea` for the storefront); list state reflected in the URL.
- Multi-tenant correctness is invisible to the customer; a wrong-tenant request must fail
  closed (403/404), never leak data.

## Non-goals / deliberate exclusions

- No shared cross-tenant data layer; isolation is per schema.
- No marketplace/multi-vendor payouts beyond Stripe Connect destination charges.
- No slug-based product routing on the storefront (products resolve by numeric id).
