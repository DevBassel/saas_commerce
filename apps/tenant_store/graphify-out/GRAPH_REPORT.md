# Graph Report - tenant_store  (2026-11-20)

## Corpus Check
- Corpus is ~32,948 words - fits in a single context window. You may not need a graph.

## Summary
- 694 nodes · 2146 edges · 30 communities (20 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Catalog Filtering Interface
- Authentication Forms and Cards
- Cart Orders and Products
- Layouts Errors and Carousel
- Base UI Primitives
- Orders Pagination and Identity
- Storefront Architecture and Flows
- Session Refresh and Proxy
- Shadcn Component Configuration
- Runtime Dependencies
- Development Dependencies
- TypeScript Compiler Settings
- ESLint and Next Configuration
- Subscription Plans and Limits
- Route Error Boundaries
- Route Loading States
- Toasts Themes and Icons
- Package Scripts
- Verification TypeScript Configuration
- Class and Token Utilities
- Document File Illustration
- Browser Window Illustration
- Vercel Brand Mark
- Carousel Dependency
- Tailwind Merge Dependency
- PostCSS Configuration
- Globe Illustration
- Next.js Brand Mark
- Numeric Product Routing

## God Nodes (most connected - your core abstractions)
1. `cn()` - 101 edges
2. `Button()` - 56 edges
3. `react` - 36 edges
4. `useTenantRouter()` - 35 edges
5. `next` - 32 edges
6. `lucide-react` - 30 edges
7. `VerifyEmailForm()` - 26 edges
8. `PlaceOrder()` - 26 edges
9. `Label()` - 24 edges
10. `withTenantParam()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `PlatformLayout()` --calls--> `cn()`  [EXTRACTED]
  src/app/(platform)/layout.tsx → src/lib/utils.ts
- `SelectGroup()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/select.tsx → src/lib/utils.ts
- `SelectLabel()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/select.tsx → src/lib/utils.ts
- `SelectSeparator()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/select.tsx → src/lib/utils.ts
- `Subdomain-Only Storefront` --conceptually_related_to--> `Tenant Resolution`  [INFERRED]
  README.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant Resolution and Navigation Flow** — apps_tenant_store_agents_tenant_resolution, apps_tenant_store_agents_root_domain_host_classification, apps_tenant_store_agents_proxy_routing_and_auth_guard, apps_tenant_store_agents_trusted_tenant_signal, apps_tenant_store_agents_tenant_parameter_navigation, apps_tenant_store_agents_context_aware_not_found [EXTRACTED 1.00]
- **Session Refresh and Retry Flow** — apps_tenant_store_agents_nextauth_jwt_session, apps_tenant_store_agents_refresh_token_rotation, apps_tenant_store_agents_failed_refresh_signout, apps_tenant_store_agents_isomorphic_api_client [EXTRACTED 1.00]
- **Documented NextAuth Login Flow** — apps_tenant_store_memory_custom_login_screen, apps_tenant_store_memory_nextauth_route_handler, apps_tenant_store_memory_core_auth_options, apps_tenant_store_memory_nextauth_type_extension, apps_tenant_store_memory_client_session_wrapper [EXTRACTED 1.00]

## Communities (30 total, 10 thin omitted)

### Community 0 - "Catalog Filtering Interface"
Cohesion: 0.05
Nodes (90): getStoreCategoryOptions(), IStoreCategoryOption, getProductPage(), CategoryOutcome, ProductOutcome, ProductsPage(), ActiveFilterChips(), ActiveFilterChipsProps (+82 more)

### Community 1 - "Authentication Forms and Cards"
Cohesion: 0.08
Nodes (69): lucide-react, next, react, sonner, registerRequest(), confirmPasswordReset(), ConfirmPasswordResetResponse, OtpPurpose (+61 more)

### Community 2 - "Cart Orders and Products"
Cohesion: 0.07
Nodes (61): axios, createAddress(), getAddresses(), IAddress, ICreateAddress, apiClient, AddToCart(), GetUserCart() (+53 more)

### Community 3 - "Layouts Errors and Carousel"
Cohesion: 0.06
Nodes (53): ApiError, isApiError(), toApiError(), getProductById(), getProducts(), ICategory, IProductImage, IProductPage (+45 more)

### Community 4 - "Base UI Primitives"
Cohesion: 0.08
Nodes (41): @base-ui/react, logout(), highlights, metadata, PlatformHomePage(), Home(), guestItems, NavBar() (+33 more)

### Community 5 - "Orders Pagination and Identity"
Cohesion: 0.08
Nodes (36): next-auth@^4.24.14, next-auth, ApiErrorBody, getClientSession(), redirectToVerifyEmail(), requestNewAccessToken(), RetryableConfig, IRegister (+28 more)

### Community 6 - "Storefront Architecture and Flows"
Cohesion: 0.05
Nodes (42): Base UI and shadcn Design System, Checkout and Payment Flow, Context-Aware Not Found Handling, Draft-Commit Product Filter UI, Dual Root Layouts, Email OTP Flow, Isomorphic API Client, NextAuth JWT Session (+34 more)

### Community 7 - "Session Refresh and Proxy"
Cohesion: 0.17
Nodes (22): POST(), encodeRotatedSession(), requestTokenRotation(), RotatedTokens, RotationResult, SESSION_MAX_AGE, sessionCookieName(), sessionCookieOptions() (+14 more)

### Community 8 - "Shadcn Component Configuration"
Cohesion: 0.09
Nodes (22): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+14 more)

### Community 9 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, axios@^1.17.0, @base-ui/react@^1.5.0, class-variance-authority@^0.7.1, input-otp@^1.5.0, lucide-react@^1.17.0, next@16.2.7, react@19.2.4 (+13 more)

### Community 10 - "Development Dependencies"
Cohesion: 0.15
Nodes (18): devDependencies, babel-plugin-react-compiler@1.0.0, tailwindcss@^4, @tailwindcss/postcss@^4, @types/node@^20, @types/react@^19, @types/react-dom@^19, typescript@^5 (+10 more)

### Community 11 - "TypeScript Compiler Settings"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 12 - "ESLint and Next Configuration"
Cohesion: 0.17
Nodes (8): eslintConfig, tsconfigRootDir, nextConfig, remotePatterns, eslint@^9, eslint-config-next@16.2.7, eslint, eslint-config-next

### Community 13 - "Subscription Plans and Limits"
Cohesion: 0.27
Nodes (8): IPlanFeature, IPlanLimit, ISubscriptionPlan, PublicPlansResult, FEATURE_LABELS, formatBytes(), formatLimit(), LIMIT_LABELS

### Community 16 - "Toasts Themes and Icons"
Cohesion: 0.33
Nodes (4): next-themes@^0.4.6, @remixicon/react@^4.9.0, next-themes, @remixicon/react

### Community 17 - "Package Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, typecheck

### Community 18 - "Verification TypeScript Configuration"
Cohesion: 0.33
Nodes (5): ./tsconfig.json, compilerOptions, incremental, extends, include

### Community 19 - "Class and Token Utilities"
Cohesion: 0.33
Nodes (4): clsx@^2.1.1, jwt-decode@^4.0.0, clsx, jwt-decode

### Community 20 - "Document File Illustration"
Cohesion: 0.50
Nodes (4): Document Content Lines, Document File Icon, Document Outline, Folded Document Corner

### Community 21 - "Browser Window Illustration"
Cohesion: 0.67
Nodes (3): Three Circular Window Controls, Rectangular Window Frame, Window Icon

## Knowledge Gaps
- **29 isolated node(s):** `./tsconfig.json`, `Next.js 16 App Router`, `React 19`, `Tailwind CSS v4`, `Base UI and shadcn Design System` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 193 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Base UI Primitives` to `Catalog Filtering Interface`, `Authentication Forms and Cards`, `Cart Orders and Products`, `Layouts Errors and Carousel`, `Orders Pagination and Identity`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `./tsconfig.json`, `Next.js 16 App Router`, `React 19` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Catalog Filtering Interface` be split into smaller, more focused modules?**
  _Cohesion score 0.05342973020631282 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Authentication Forms and Cards` to `Catalog Filtering Interface`, `Cart Orders and Products`, `Layouts Errors and Carousel`, `Base UI Primitives`, `Orders Pagination and Identity`, `Session Refresh and Proxy`, `Runtime Dependencies`, `Development Dependencies`, `ESLint and Next Configuration`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Should `Authentication Forms and Cards` be split into smaller, more focused modules?**
  _Cohesion score 0.08391771856007481 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Authentication Forms and Cards` to `Catalog Filtering Interface`, `Cart Orders and Products`, `Layouts Errors and Carousel`, `Base UI Primitives`, `Orders Pagination and Identity`, `Runtime Dependencies`, `Development Dependencies`, `Route Error Boundaries`, `Route Loading States`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Should `Cart Orders and Products` be split into smaller, more focused modules?**
  _Cohesion score 0.0699942627653471 - nodes in this community are weakly interconnected._