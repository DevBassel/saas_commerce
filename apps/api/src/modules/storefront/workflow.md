```mermaid
flowchart TD
    Browser["Storefront / SEO crawler<br/>Host: my-store.APP_ROOT_DOMAIN"] --> MW["TenantMiddleware<br/>subdomain -> tenant + AsyncLocalStorage"]
    MW --> TG{"TenantGuard — runs even for @Public routes"}
    TG -->|"no identifier / unknown tenant"| ERR["400 Tenant not resolvable / 404 Tenant not found"]
    TG -->|"resolved ACTIVE tenant"| CTRL["StorefrontController<br/>GET /api/v1/store/info<br/>GET /api/v1/store/categories"]
    CTRL -->|"info"| INFO["{ name, slug, currency }<br/>from req.tenant — no database reads"]
    CTRL -->|"categories"| CS["CategoriesService.findStorefrontOptions(tenant)<br/>active categories projected to { id, name }"]
    CS --> CDB[("PostgreSQL tenant schema<br/>categories")]
```

```mermaid
flowchart TD
    subgraph PUBLIC["Public tenant-scoped catalog (@Public, TenantGuard still resolves the tenant)"]
        PP["GET /products, GET /products/:id"] --> PS["ProductsService<br/>reads tenant schema via x-tenant-slug / subdomain"]
        SC["GET /store/categories"] --> CSF["CategoriesService.findStorefrontOptions<br/>active only, ordered by name then id"]
    end

    subgraph AUTH["Authenticated catalog management (no @Public)"]
        CC["GET /categories, GET /categories/:id<br/>+ category and product writes"] --> GUARD["JwtGuard + PermissionGuard<br/>products:read / categories:read / ..."]
        GUARD --> CS["CategoriesService / ProductsService"]
    end

    PS --> DB[("PostgreSQL tenant schema<br/>products, product_images, categories")]
    CSF --> DB
    CS --> DB
```

`GET /store/categories` is additive and intentionally uncached (no `@CacheResponse`), so the response
interceptor emits `Cache-Control: private, no-store` and `X-Cache: BYPASS`. It exposes only active
category IDs and names; it does not make the protected `/categories` management routes public.

The storefront application (`apps/tenant_store`) renders `/products` in a Server Component. It
resolves the tenant from the trusted `x-tenant-slug` header, then loads `/store/categories` and the
filtered `/products` envelope concurrently through a request-local anonymous Axios instance that
sends only that tenant header — no session token or cookies. Filter state lives in the URL. Browser
code still calls the backend directly for authenticated cart/order/payment flows.
