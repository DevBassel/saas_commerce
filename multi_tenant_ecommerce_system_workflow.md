# Multi-Tenant E-Commerce System Workflow Diagram

## Main Request Workflow

``` mermaid
flowchart TD

A[User] --> B[Tenant Subdomain]
B --> C[NestJS REST API]
C --> D[Tenant Resolver]
D --> E[Find Tenant in Public Schema]
E --> F[Select Tenant PostgreSQL Schema]
F --> G[Tenant Business Modules]
G --> H[Products / Orders / Inventory / Payments]
H --> I[Response]
```

## Tenant Creation Workflow

``` mermaid
flowchart TD

A[Platform Admin]
A --> B[Create Tenant]
B --> C[Generate Subdomain]
C --> D[Save Tenant in Public Schema]
D --> E[Create Tenant PostgreSQL Schema]
E --> F[Run Tenant Migrations]
F --> G[Create Tenant Admin]
G --> H[Tenant Ready]
```

## Order Workflow

``` mermaid
flowchart LR

A[Customer]
A --> B[Browse Products]
B --> C[Cart]
C --> D[Checkout]
D --> E[Create Order]
E --> F[Inventory Update]
F --> G[Payment]
G --> H[Order Confirmed]
H --> I[Notification]
```

## System Architecture

``` mermaid
flowchart TB

User[Users]

DNS[Wildcard DNS *.platform.com]

API[NestJS REST API]

Resolver[Tenant Resolver]

Public[(Public Schema)]

Tenant1[(tenant_nike)]
Tenant2[(tenant_amazon)]

User --> DNS
DNS --> API
API --> Resolver
Resolver --> Public
Resolver --> Tenant1
Resolver --> Tenant2
```

## Data Isolation

    PostgreSQL

    public
     |
     |-- tenants
     |-- users
     |-- subscriptions
     |-- domains


    tenant_nike
     |
     |-- products
     |-- orders
     |-- customers
     |-- payments


    tenant_amazon
     |
     |-- products
     |-- orders
     |-- customers
     |-- payments

## Request Example

    nike.platform.com/products

    1. Receive request
    2. Detect tenant from subdomain
    3. Find tenant configuration
    4. Switch to tenant schema
    5. Execute business logic
    6. Return response

## Benefits

-   Strong tenant isolation
-   Separate tenant data
-   Easy backup and migration
-   Shared NestJS infrastructure
-   SaaS ready architecture
