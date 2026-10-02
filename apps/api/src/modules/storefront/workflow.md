```mermaid
flowchart TD
    Browser["Storefront / SEO crawler<br/>Host: my-store.APP_ROOT_DOMAIN"] --> MW["TenantMiddleware<br/>subdomain -> tenant + AsyncLocalStorage"]
    MW --> TG{"TenantGuard — runs even for @Public routes"}
    TG -->|"no identifier / unknown tenant"| ERR["400 Tenant not resolvable / 404 Tenant not found"]
    TG -->|"resolved ACTIVE tenant"| CTRL["StorefrontController<br/>GET /api/v1/store/info"]
    CTRL --> OUT["{ name, slug, currency }<br/>from req.tenant — no database reads"]
```

```mermaid
flowchart TD
    subgraph PUBLIC["Public tenant-scoped catalog (@Public, TenantGuard still resolves the tenant)"]
        PP["GET /products, GET /products/:id"] --> PS["ProductsService<br/>reads tenant schema via x-tenant-slug / subdomain"]
    end

    subgraph AUTH["Authenticated catalog management (no @Public)"]
        CC["GET /categories, GET /categories/:id<br/>+ category and product writes"] --> GUARD["JwtGuard + PermissionGuard<br/>products:read / categories:read / ..."]
        GUARD --> CS["CategoriesService / ProductsService"]
    end

    PS --> DB[("PostgreSQL tenant schema<br/>products, product_images, categories")]
    CS --> DB
```

The storefront module itself is intentionally tiny: it exposes only the public, tenant-resolved `GET /store/info` branding endpoint and performs no repository access. The storefront application (`apps/tenant_store`) reads the public product catalog from the products module and resolves branding from this endpoint through its own Next route handlers; browser code never calls the API directly.
