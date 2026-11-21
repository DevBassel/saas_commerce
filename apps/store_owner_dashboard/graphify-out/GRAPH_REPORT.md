# Graph Report - store_owner_dashboard  (2026-11-20)

## Corpus Check
- 204 files · ~94,308 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 3, .ico 3, (none) 2)

## Summary
- 4382 nodes · 12628 edges · 128 communities (103 shown, 25 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 823 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- dist-false Minified Main Bundle
- dist-true Minified Main Bundle
- dist-true Minified Runtime Functions
- dist-false Minified Runtime Functions
- dist-false Query Client Internals
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Functions
- Dashboard Layout and Navigation
- dist-true Minified Bundle Functions
- Forms and Email Verification
- Routing Lists and Theming
- Interactive Controls and Checkout
- Catalog Schemas and Editing
- dist-false Minified Bundle Functions
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Functions
- Order and User Management
- Detail Views and Formatting
- dist-true Axios Data Structures
- dist-false Axios Data Structures
- dist-false Minified Bundle Functions
- dist-true Minified Runtime Helpers
- dist-false Minified Bundle Helpers
- dist-true Query Observer Internals
- dist-true Minified Bundle Helpers
- Resource Actions and Navigation
- dist-true Minified Bundle Functions
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Functions
- dist-false Zod String Validation
- dist-true Zod String Validation
- dist-true Minified Bundle Functions
- Subscription Plans and Usage
- dist-false Minified Runtime Helpers
- Project Architecture Documentation
- dist-false Zod Schema Methods
- dist-true Zod Schema Methods
- dist-true Minified Bundle Functions
- dist-false Query Runtime Internals
- dist-true Query Client Internals
- dist-false Zod Wrapper Schemas
- dist-false Minified Bundle Functions
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Functions
- dist-false Zod Parser Types
- dist-false Minified Bundle Functions
- dist-true Zod Wrapper Schemas
- dist-true Zod Parser Types
- dist-false Minified Bundle Functions
- Runtime Frontend Dependencies
- dist-true Minified Bundle Functions
- Development Tooling Dependencies
- API Client and Endpoints
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Functions
- dist-false Minified Bundle Functions
- dist-false Minified Bundle Functions
- dist-false Minified Bundle Functions
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Functions
- dist-true Minified Bundle Functions
- dist-false Zod Number Validation
- dist-true Zod Collection Parsers
- dist-true Zod Number Validation
- Package Metadata and Dependencies
- Tenant Authentication and Tokens
- TypeScript Application Configuration
- dist-false Zod Collection Parsers
- dist-false Zod Object Schemas
- dist-true Query Defaults Internals
- dist-true Minified Bundle Functions
- dist-true Zod Object Schemas
- dist-true Minified Bundle Functions
- Tenant Resolution and Persistence
- Shadcn Component Configuration
- dist-false Axios Request Internals
- dist-true Axios Request Internals
- TypeScript Node Configuration
- dist-false Minified Parser Functions
- dist-true Minified Parser Functions
- dist-false Zod Numeric Bounds
- dist-true Zod Numeric Bounds
- Data Provider Query Utilities
- dist-false Zod Parse Status
- dist-true Zod Parse Status
- Session Refresh and Tenant Sync
- Email Verification Context
- dist-false Minified Bundle Helpers
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Helpers
- dist-true Minified Bundle Functions
- dist-false Minified Bundle Helpers
- dist-false Zod Error Formatting
- dist-false Minified Bundle Helpers
- dist-false Zod Set Validation
- dist-true Minified Bundle Helpers
- dist-true Zod Error Formatting
- dist-true Minified Bundle Helpers
- Vite and Test Configuration
- dist-false Zod Enum Schemas
- dist-true Zod Enum Schemas
- Package Scripts and Commands
- dist-false Zod Array Schemas
- dist-true Zod Array Schemas
- dist-true Zod Set Validation
- Store Currency API Types
- dist-false Minified Bundle Helpers
- dist-true Minified Bundle Helpers
- dist-false Compiled HTML Shell
- dist-true Compiled HTML Shell
- dist-false Minified Bundle Functions
- dist-true Minified Bundle Functions
- Application HTML Entry
- dist-false Minified Bundle Helpers
- dist-false Zod Parser Schema
- dist-true Minified Bundle Helpers
- dist-true Zod Parser Schema
- Class Name Utility Dependency
- OTP Input Dependency
- PostCSS Dependency
- Radix Collapsible Dependency
- Radix Select Dependency
- Radix Switch Dependency
- Radix Tooltip Dependency
- React DOM Dependency
- Refine Kbar Dependency
- Stripe React Dependency

## God Nodes (most connected - your core abstractions)
1. `q3()` - 316 edges
2. `q3()` - 316 edges
3. `cn()` - 220 edges
4. `t()` - 133 edges
5. `t()` - 133 edges
6. `n()` - 113 edges
7. `n()` - 113 edges
8. `Button()` - 74 edges
9. `r()` - 71 edges
10. `r()` - 71 edges

## Surprising Connections (you probably didn't know these)
- `VerifyEmailForm()` --indirect_call--> `readVerificationContext()`  [INFERRED]
  src/components/refine-ui/form/verify-email-form.tsx → src/lib/verification-context.ts
- `BreadcrumbLink()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/breadcrumb.tsx → src/lib/utils.ts
- `BreadcrumbEllipsis()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/breadcrumb.tsx → src/lib/utils.ts
- `SelectLabel()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/select.tsx → src/lib/utils.ts
- `SelectSeparator()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/select.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant Resolution Flow** — apps_store_owner_dashboard_agents_apex_tenant_parameter_mode, apps_store_owner_dashboard_agents_tenant_resolution_precedence, apps_store_owner_dashboard_agents_gettenantheaderslug, apps_store_owner_dashboard_agents_getguardtenantslug, apps_store_owner_dashboard_agents_tenantparamsync [EXTRACTED 1.00]
- **Tenant Authentication Flow** — apps_store_owner_dashboard_agents_authprovider, apps_store_owner_dashboard_agents_token_storage, apps_store_owner_dashboard_agents_single_flight_refresh, apps_store_owner_dashboard_agents_apiclient, apps_store_owner_dashboard_agents_api_security_boundary [EXTRACTED 1.00]
- **Subscription Payment Lifecycle** — apps_store_owner_dashboard_agents_plancheckoutdialog, apps_store_owner_dashboard_agents_payment_intent_deduplication, apps_store_owner_dashboard_agents_webhook_plan_activation, apps_store_owner_dashboard_agents_subscription_activation_polling, apps_store_owner_dashboard_agents_cancel_refund_flow [EXTRACTED 1.00]

## Communities (128 total, 25 thin omitted)

### Community 0 - "dist-false Minified Main Bundle"
Cohesion: 0.01
Nodes (135): _0(), $3(), _4(), _7(), a6(), after(), AH(), are() (+127 more)

### Community 1 - "dist-true Minified Main Bundle"
Cohesion: 0.01
Nodes (127): _0(), $3(), _4(), a6(), after(), are(), aue(), az() (+119 more)

### Community 2 - "dist-true Minified Runtime Functions"
Cohesion: 0.03
Nodes (150): _5(), a5(), Aa(), accessor(), s(), aD(), m(), aq() (+142 more)

### Community 3 - "dist-false Minified Runtime Functions"
Cohesion: 0.03
Nodes (124): a5(), accessor(), s(), aD(), m(), aq(), B3(), s() (+116 more)

### Community 4 - "dist-false Query Client Internals"
Cohesion: 0.03
Nodes (86): addObserver(), bindMethods(), cancel(), cancelQueries(), clearGcTimeout(), constructor(), continue(), createResult() (+78 more)

### Community 5 - "dist-false Minified Bundle Functions"
Cohesion: 0.05
Nodes (85): q3(), _A(), ad(), BC(), bd(), o(), BE(), bh() (+77 more)

### Community 6 - "dist-true Minified Bundle Functions"
Cohesion: 0.05
Nodes (80): q3(), _A(), a3(), aA(), AC(), ap(), AU(), Az() (+72 more)

### Community 7 - "Dashboard Layout and Navigation"
Cohesion: 0.07
Nodes (70): ErrorComponent(), DesktopHeader(), Header(), MobileHeader(), UserDropdown(), Layout(), getDisplayName(), ItemIcon() (+62 more)

### Community 8 - "dist-true Minified Bundle Functions"
Cohesion: 0.04
Nodes (85): _7(), a7(), ag(), AH(), Ak(), b7(), C7(), Cl() (+77 more)

### Community 9 - "Forms and Email Verification"
Cohesion: 0.10
Nodes (57): @radix-ui/react-label, react-hook-form, confirmPasswordReset(), ConfirmPasswordResetResponse, OtpPurpose, requestOtp(), RequestOtpResponse, verifyEmailOtp() (+49 more)

### Community 10 - "Routing Lists and Theming"
Cohesion: 0.06
Nodes (52): react-router, @refinedev/react-table, App(), Devtools(), categoryColumns, CategoryRowActions(), ErrorBoundary, ErrorBoundaryProps (+44 more)

### Community 11 - "Interactive Controls and Checkout"
Cohesion: 0.08
Nodes (64): sonner, toApiError(), subscriptionsApi, OrderStatusActions(), CategorySelect(), ProductImagesManager(), ProductImagesManagerProps, ProductImagesManagerView() (+56 more)

### Community 12 - "Catalog Schemas and Editing"
Cohesion: 0.06
Nodes (50): zod@^3.24.3, @hookform/resolvers, @refinedev/react-hook-form, vitest, zod, CategoryFormValues, categorySchema, valid (+42 more)

### Community 13 - "dist-false Minified Bundle Functions"
Cohesion: 0.04
Nodes (60): A1(), aee(), r(), t(), AJ(), bee(), cee(), CJ() (+52 more)

### Community 14 - "dist-false Minified Bundle Functions"
Cohesion: 0.05
Nodes (69): a7(), ag(), Ak(), b7(), Cl(), Cn(), dc(), dk() (+61 more)

### Community 15 - "dist-true Minified Bundle Functions"
Cohesion: 0.08
Nodes (68): Z(), ad(), AE(), aR(), As(), Av(), ay(), bv() (+60 more)

### Community 16 - "Order and User Management"
Cohesion: 0.06
Nodes (49): @tanstack/react-table, orderColumns, BadgeVariant, ORDER_STATUS_VARIANTS, PAYMENT_STATUS_VARIANTS, DataTableSorter(), DataTableSorterProps, DateCell() (+41 more)

### Community 17 - "Detail Views and Formatting"
Cohesion: 0.17
Nodes (43): CurrencyCell(), StatCard(), StorageCard(), OrderStatusBadge(), PaymentStatusBadge(), ActiveBadge(), DetailRow(), QueryErrorState() (+35 more)

### Community 18 - "dist-true Axios Data Structures"
Cohesion: 0.04
Nodes (54): add(), build(), bV(), c6(), canRun(), cD(), clear(), delete() (+46 more)

### Community 19 - "dist-false Axios Data Structures"
Cohesion: 0.04
Nodes (49): bJ(), delete(), deleteAt(), Dj(), get(), getSetCookie(), gg(), Gj() (+41 more)

### Community 20 - "dist-false Minified Bundle Functions"
Cohesion: 0.11
Nodes (57): aA(), AU(), Az(), b3(), cn(), Dy(), Es(), fA() (+49 more)

### Community 21 - "dist-true Minified Runtime Helpers"
Cohesion: 0.05
Nodes (48): clearInterval(), clearTimeout(), EJ(), ez(), I9(), c(), i(), l() (+40 more)

### Community 22 - "dist-false Minified Bundle Helpers"
Cohesion: 0.07
Nodes (52): F3(), B(), F(), j(), k(), N(), P(), q() (+44 more)

### Community 23 - "dist-true Query Observer Internals"
Cohesion: 0.05
Nodes (45): addObserver(), bindMethods(), clearGcTimeout(), constructor(), createResult(), destroy(), fetchOptimistic(), g_() (+37 more)

### Community 24 - "dist-true Minified Bundle Helpers"
Cohesion: 0.07
Nodes (52): F3(), B(), F(), j(), k(), N(), P(), q() (+44 more)

### Community 25 - "Resource Actions and Navigation"
Cohesion: 0.08
Nodes (36): class-variance-authority, lucide-react, @radix-ui/react-slot, react, @refinedev/core, CouponRowActions(), OrderRowActions(), ProductRowActions() (+28 more)

### Community 26 - "dist-true Minified Bundle Functions"
Cohesion: 0.07
Nodes (53): $1(), A4(), B1(), cne(), dne(), ds(), eM(), F1() (+45 more)

### Community 27 - "dist-false Minified Bundle Functions"
Cohesion: 0.07
Nodes (52): $1(), A4(), B1(), cne(), dne(), ds(), eM(), F1() (+44 more)

### Community 28 - "dist-true Minified Bundle Functions"
Cohesion: 0.05
Nodes (43): A1(), aee(), r(), t(), AJ(), bee(), cee(), CJ() (+35 more)

### Community 31 - "dist-true Minified Bundle Functions"
Cohesion: 0.16
Nodes (45): bU(), cn(), Dy(), fR(), C(), dn(), dt(), ee() (+37 more)

### Community 32 - "Subscription Plans and Usage"
Cohesion: 0.10
Nodes (36): inFlight, StorageRing(), Tabs(), TabsContent(), TabsList(), TabsTrigger(), BILLING_INTERVAL_LABELS, FEATURE_LABELS (+28 more)

### Community 33 - "dist-false Minified Runtime Helpers"
Cohesion: 0.08
Nodes (40): clearInterval(), clearTimeout(), EJ(), ez(), I9(), c(), i(), l() (+32 more)

### Community 34 - "Project Architecture Documentation"
Cohesion: 0.07
Nodes (20): apiClient, Custom authProvider, CancelSubscriptionDialog, Custom Refine DataProvider, Refine React Vite Frontend Stack, getGuardTenantSlug, getTenantHeaderSlug, PlanCheckoutDialog (+12 more)

### Community 35 - "dist-false Zod Schema Methods"
Cohesion: 0.08
Nodes (4): At(), Qt(), RX, TS

### Community 36 - "dist-true Zod Schema Methods"
Cohesion: 0.08
Nodes (4): At(), Qt(), RX, TS

### Community 37 - "dist-true Minified Bundle Functions"
Cohesion: 0.07
Nodes (27): bJ(), gg(), Gj(), e(), t(), GV(), hg(), kJ() (+19 more)

### Community 38 - "dist-false Query Runtime Internals"
Cohesion: 0.06
Nodes (30): add(), build(), bV(), c6(), canRun(), cD(), clear(), s() (+22 more)

### Community 39 - "dist-true Query Client Internals"
Cohesion: 0.07
Nodes (33): cancelQueries(), defaultMutationOptions(), defaultQueryOptions(), ensureInfiniteQueryData(), ensureQueryData(), f4(), fetchInfiniteQuery(), fetchQuery() (+25 more)

### Community 40 - "dist-false Zod Wrapper Schemas"
Cohesion: 0.06
Nodes (31): aS(), Bc(), Bue(), ct(), die(), Dl(), Dte(), f$() (+23 more)

### Community 41 - "dist-false Minified Bundle Functions"
Cohesion: 0.13
Nodes (35): AE(), bv(), cr(), eR(), ey(), fp(), gd(), gv() (+27 more)

### Community 42 - "dist-false Minified Bundle Functions"
Cohesion: 0.11
Nodes (35): Ah(), aR(), As(), Av(), ay(), Ce(), Dh(), dR() (+27 more)

### Community 43 - "dist-true Minified Bundle Functions"
Cohesion: 0.12
Nodes (35): et(), _3(), at(), b3(), By(), dA(), Es(), Ev() (+27 more)

### Community 44 - "dist-false Zod Parser Types"
Cohesion: 0.10
Nodes (13): bO(), EX(), He(), JN, i(), nX(), qN, RS (+5 more)

### Community 45 - "dist-false Minified Bundle Functions"
Cohesion: 0.11
Nodes (24): GM(), an(), be(), Ce(), de(), _e(), Ee(), Fe() (+16 more)

### Community 46 - "dist-true Zod Wrapper Schemas"
Cohesion: 0.07
Nodes (28): aS(), Bc(), Bue(), ct(), Dl(), Dte(), f$(), FT() (+20 more)

### Community 47 - "dist-true Zod Parser Types"
Cohesion: 0.10
Nodes (12): bO(), EX(), He(), JN, i(), nX(), qN, RS (+4 more)

### Community 48 - "dist-false Minified Bundle Functions"
Cohesion: 0.08
Nodes (30): _5(), Aa(), b5(), bD(), c5(), E(), f5(), g5() (+22 more)

### Community 49 - "Runtime Frontend Dependencies"
Cohesion: 0.07
Nodes (30): dependencies, class-variance-authority@^0.7.1, @hookform/resolvers@^5.0.1, jwt-decode@^4.0.0, lucide-react@^0.487.0, @radix-ui/react-avatar@^1.1.7, @radix-ui/react-dropdown-menu@^2.1.12, @radix-ui/react-label@^2.1.4 (+22 more)

### Community 50 - "dist-true Minified Bundle Functions"
Cohesion: 0.12
Nodes (21): GM(), an(), be(), Ce(), de(), _e(), Ee(), Fe() (+13 more)

### Community 51 - "Development Tooling Dependencies"
Cohesion: 0.08
Nodes (28): devDependencies, eslint@^9.25.0, @eslint/js@^9.25.0, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.19, globals@^16.0.0, jsdom@^30.0.1, tailwindcss@^4.1.4 (+20 more)

### Community 52 - "API Client and Endpoints"
Cohesion: 0.10
Nodes (19): axios@^1.20.0, axios, apiClient, ApiError, AUTH_ENDPOINTS, extractCode(), extractMessage(), RetriableRequestConfig (+11 more)

### Community 53 - "dist-false Minified Bundle Functions"
Cohesion: 0.18
Nodes (27): br(), Bs(), bU(), cd(), cy(), Dd(), Ds(), Ed() (+19 more)

### Community 54 - "dist-true Minified Bundle Functions"
Cohesion: 0.13
Nodes (27): bd(), o(), BE(), bh(), Bn(), gE(), iA(), In() (+19 more)

### Community 55 - "dist-false Minified Bundle Functions"
Cohesion: 0.09
Nodes (24): bte(), da(), g4(), gte(), HI(), ho(), hte(), Ic() (+16 more)

### Community 56 - "dist-false Minified Bundle Functions"
Cohesion: 0.13
Nodes (25): et(), a3(), AC(), ap(), at(), bA(), d3(), dA() (+17 more)

### Community 57 - "dist-false Minified Bundle Functions"
Cohesion: 0.15
Nodes (25): Ai(), c(), cA(), Cv(), d(), Eu(), Fv(), gE() (+17 more)

### Community 58 - "dist-false Minified Bundle Functions"
Cohesion: 0.16
Nodes (24): de(), Di(), Dv(), _E(), fE(), GU(), Hv(), i() (+16 more)

### Community 59 - "dist-true Minified Bundle Functions"
Cohesion: 0.09
Nodes (23): bte(), da(), g4(), gte(), HI(), ho(), hte(), Ic() (+15 more)

### Community 60 - "dist-true Minified Bundle Functions"
Cohesion: 0.20
Nodes (23): br(), Bs(), cd(), Dd(), Ds(), Ed(), ep(), fn() (+15 more)

### Community 61 - "dist-false Zod Number Validation"
Cohesion: 0.14
Nodes (3): Gk(), Kf(), Pc()

### Community 62 - "dist-true Zod Collection Parsers"
Cohesion: 0.09
Nodes (6): kI(), Mm, Pm, Tl, x1, yN()

### Community 63 - "dist-true Zod Number Validation"
Cohesion: 0.15
Nodes (4): Gk(), Kf(), Pc(), us()

### Community 64 - "Package Metadata and Dependencies"
Cohesion: 0.09
Nodes (21): browserslist, development, production, @radix-ui/react-dialog@^1.1.11, @radix-ui/react-popover@^1.1.11, @radix-ui/react-separator@^1.1.4, @refinedev/devtools@^2.0.1, @stripe/stripe-js@^9.8.0 (+13 more)

### Community 65 - "Tenant Authentication and Tokens"
Cohesion: 0.14
Nodes (19): authApi, RegisterUserPayload, RegisterUserResponse, TenantLoginPayload, TenantLoginResponse, TokenPair, tokenStorage, unauthenticatedRedirect() (+11 more)

### Community 66 - "TypeScript Application Configuration"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, jsx, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 67 - "dist-false Zod Collection Parsers"
Cohesion: 0.10
Nodes (6): kI(), Mm, Pm, Tl, x1, yN()

### Community 69 - "dist-true Query Defaults Internals"
Cohesion: 0.12
Nodes (15): FJ(), HJ(), r(), IJ(), LJ(), qJ(), e(), t() (+7 more)

### Community 70 - "dist-true Minified Bundle Functions"
Cohesion: 0.17
Nodes (19): pt(), Ah(), Ai(), cA(), cy(), Eu(), Fv(), GU() (+11 more)

### Community 72 - "dist-true Minified Bundle Functions"
Cohesion: 0.22
Nodes (18): de(), Di(), Dv(), fp(), i(), Ih(), Ii(), IU() (+10 more)

### Community 73 - "Tenant Resolution and Persistence"
Cohesion: 0.27
Nodes (17): allowSubdomain(), ensureTenantParamInUrl(), getAppRootDomain(), getCurrentTenantSlug(), getPersistedTenantSlug(), getTenantHeaderSlug(), getTenantSlugFromHost(), getTenantSlugFromParam() (+9 more)

### Community 74 - "Shadcn Component Configuration"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 75 - "dist-false Axios Request Internals"
Cohesion: 0.16
Nodes (17): cI(), dI(), getUri(), gI(), nI(), Ol(), c(), d() (+9 more)

### Community 76 - "dist-true Axios Request Internals"
Cohesion: 0.16
Nodes (17): cI(), dI(), getUri(), gI(), nI(), Ol(), c(), d() (+9 more)

### Community 77 - "TypeScript Node Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 78 - "dist-false Minified Parser Functions"
Cohesion: 0.18
Nodes (16): bN(), Br(), bW(), c1(), Ie(), JW(), mn(), N1() (+8 more)

### Community 79 - "dist-true Minified Parser Functions"
Cohesion: 0.17
Nodes (16): bN(), Br(), bW(), c1(), Ie(), JW(), mn(), N1() (+8 more)

### Community 82 - "Data Provider Query Utilities"
Cohesion: 0.26
Nodes (10): applyFilters(), applyPagination(), applySorters(), buildListParams(), getFieldValue(), resolveDetailPath(), Row, rows (+2 more)

### Community 83 - "dist-false Zod Parse Status"
Cohesion: 0.17
Nodes (6): AL(), ca, CX(), SX(), wX(), xX()

### Community 84 - "dist-true Zod Parse Status"
Cohesion: 0.17
Nodes (6): AL(), ca, CX(), SX(), wX(), xX()

### Community 85 - "Session Refresh and Tenant Sync"
Cohesion: 0.27
Nodes (5): refreshSession(), TenantParamSync(), resetClientState(), resolveTenantSync(), TenantSyncState

### Community 86 - "Email Verification Context"
Cohesion: 0.40
Nodes (9): clearVerificationContext(), getCurrentTenantSlug(), getSessionStorage(), normalizeEmail(), readVerificationContext(), removeStoredContext(), NOW, VerificationContext (+1 more)

### Community 87 - "dist-false Minified Bundle Helpers"
Cohesion: 0.22
Nodes (6): b4(), D1(), fa(), G1(), v1(), x4()

### Community 88 - "dist-false Minified Bundle Functions"
Cohesion: 0.42
Nodes (10): _3(), By(), jU(), kd(), m3(), pp(), Tn(), uA() (+2 more)

### Community 89 - "dist-true Minified Bundle Helpers"
Cohesion: 0.22
Nodes (6): b4(), D1(), fa(), G1(), v1(), x4()

### Community 90 - "dist-true Minified Bundle Functions"
Cohesion: 0.24
Nodes (10): eE(), fy(), HR(), Io(), LU(), te(), uv(), Yg() (+2 more)

### Community 91 - "dist-false Minified Bundle Helpers"
Cohesion: 0.33
Nodes (9): b0(), bK(), eI(), sg(), b(), S(), v(), x() (+1 more)

### Community 93 - "dist-false Minified Bundle Helpers"
Cohesion: 0.39
Nodes (7): q5(), d(), g(), h(), m(), S(), v()

### Community 94 - "dist-false Zod Set Validation"
Cohesion: 0.22
Nodes (3): Rf, vse(), yse()

### Community 95 - "dist-true Minified Bundle Helpers"
Cohesion: 0.33
Nodes (9): b0(), bK(), eI(), sg(), b(), S(), v(), x() (+1 more)

### Community 97 - "dist-true Minified Bundle Helpers"
Cohesion: 0.39
Nodes (7): q5(), d(), g(), h(), m(), S(), v()

### Community 98 - "Vite and Test Configuration"
Cohesion: 0.22
Nodes (6): @tailwindcss/vite@^4.1.8, vite@^6.3.5, @vitejs/plugin-react@^4.4.1, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 101 - "Package Scripts and Commands"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, refine, start, test, typecheck

### Community 104 - "dist-true Zod Set Validation"
Cohesion: 0.29
Nodes (3): Rf, vse(), yse()

### Community 105 - "Store Currency API Types"
Cohesion: 0.38
Nodes (5): currencyApi, CurrencyChangeRequest, CurrencyChangeRequestStatus, StoreCurrencyState, StoreInfo

### Community 106 - "dist-false Minified Bundle Helpers"
Cohesion: 0.40
Nodes (4): K3(), m(), r(), Y3()

### Community 107 - "dist-true Minified Bundle Helpers"
Cohesion: 0.40
Nodes (4): K3(), m(), r(), Y3()

### Community 108 - "dist-false Compiled HTML Shell"
Cohesion: 0.50
Nodes (4): index-D7-PA71n.js Bundle, dist-false root Application Mount, Store Owner dist-false HTML Shell, index-D8gEIdtd.css Bundle

### Community 109 - "dist-true Compiled HTML Shell"
Cohesion: 0.50
Nodes (4): index-Dn-NGHJp.js Bundle, dist-true root Application Mount, Store Owner dist-true HTML Shell, index-IntX9V8r.css Bundle

### Community 110 - "dist-false Minified Bundle Functions"
Cohesion: 0.67
Nodes (4): aI(), iI(), t(), NK()

### Community 111 - "dist-true Minified Bundle Functions"
Cohesion: 0.67
Nodes (4): aI(), iI(), t(), NK()

### Community 112 - "Application HTML Entry"
Cohesion: 0.67
Nodes (3): root Application Mount, src/index.tsx Entry Module, Store Owner HTML Shell

### Community 113 - "dist-false Minified Bundle Helpers"
Cohesion: 1.00
Nodes (3): $9(), g(), m()

### Community 115 - "dist-true Minified Bundle Helpers"
Cohesion: 1.00
Nodes (3): $9(), g(), m()

## Knowledge Gaps
- **16 isolated node(s):** `TenantParamSync`, `Custom Refine DataProvider`, `Vendored Refine UI System`, `Refine Documentation`, `REST Data Provider Documentation` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 884 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `q3()` connect `dist-true Minified Bundle Functions` to `dist-true Minified Main Bundle`, `dist-true Minified Runtime Functions`, `dist-true Minified Bundle Functions`, `dist-true Minified Bundle Functions`, `dist-true Minified Bundle Functions`, `dist-true Minified Bundle Functions`, `dist-true Minified Bundle Functions`, `dist-true Minified Bundle Helpers`, `dist-true Minified Bundle Functions`, `dist-true Minified Bundle Functions`, `dist-true Minified Bundle Functions`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `q3()` (e.g. with `aR()` and `b3()`) actually correct?**
  _`q3()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **What connects `TenantParamSync`, `Custom Refine DataProvider`, `Vendored Refine UI System` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dist-false Minified Main Bundle` be split into smaller, more focused modules?**
  _Cohesion score 0.009461940403897754 - nodes in this community are weakly interconnected._
- **Why does `q3()` connect `dist-false Minified Bundle Functions` to `dist-false Minified Main Bundle`, `dist-false Minified Runtime Functions`, `dist-false Minified Bundle Functions`, `dist-false Minified Bundle Functions`, `dist-false Minified Bundle Functions`, `dist-false Minified Bundle Functions`, `dist-false Minified Bundle Functions`, `dist-false Minified Bundle Helpers`, `dist-false Minified Bundle Functions`, `dist-false Minified Bundle Functions`, `dist-false Minified Bundle Functions`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `q3()` (e.g. with `aR()` and `b3()`) actually correct?**
  _`q3()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Should `dist-true Minified Main Bundle` be split into smaller, more focused modules?**
  _Cohesion score 0.00953068232717862 - nodes in this community are weakly interconnected._