# Graph Report - api  (2026-11-20)

## Corpus Check
- 473 files · ~174,855 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .example 1)

## Summary
- 3209 nodes · 9187 edges · 156 communities (111 shown, 45 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 371 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output (subagent usage unavailable from this runtime; not a zero-cost claim)

## Community Hubs (Navigation)
- Authentication and Cache Pipeline
- Subscription Lifecycle Management
- Application Configuration Services
- Order Payments and Refunds
- Tenant Provisioning and Management
- Application Module Composition
- Subscription Payment Refunds
- TypeORM Migration Configuration
- Permission Definitions and Seeding
- Tenant Database Provisioning
- Development Dependencies
- Tenant Authentication Context
- Payment API Facade
- Runtime Package Dependencies
- Email Delivery Transports
- Platform Payment Administration
- Stripe Webhook Infrastructure
- Subscription Entitlement Enforcement
- Build and Migration Scripts
- Subscription Usage Tracking
- Coupon API Validation
- Platform Authorization Controls
- User Administration Endpoints
- Address Module API
- Tenant Seeding and Policy
- Subscription Payment Intents
- Category Catalog Services
- User and OTP Entities
- Order Management API
- Subscription Plan Administration
- User Management Workflow
- Stripe Connect Onboarding
- Subscription Entitlement Guards
- Product API Validation
- Platform Tenant Administration
- Shopping Cart Management
- Product Catalog Entities
- TypeScript Compiler Configuration
- Shopping Cart Entities
- Product Query Validation
- Coupon Discount Logic
- Order Payment Processing
- Subscription Ledger Entities
- Tenant Cache Infrastructure
- Currency Change Validation
- RBAC Role Management
- Seeding Module Registry
- Subscription Assignment and Limits
- User Authorization Management
- User Access Administration
- RBAC Roles and Permissions
- Paginated List Queries
- Cloud Object Storage
- Transactional Commerce Workflows
- Product Catalog Endpoints
- Coupon Validation and Consumption
- Email OTP Contracts
- Redis Cache Infrastructure
- Cache Route Decoration
- Stripe Webhook Processing
- Permission Management API
- Product Catalog Operations
- Pagination and Sorting
- Authentication Service Flows
- Category Management API
- Tenant Data Seeding
- Subscription Lifecycle States
- Public Authentication Endpoints
- Seeder Registry
- Authentication API Validation
- Store Registration Ownership
- Coupon Management Endpoints
- Order Lifecycle Operations
- Dashboard Metrics API
- Email OTP Security
- Subscription Plan Input Validation
- System Architecture Documentation
- Customer Address Management
- Coupon Redemption Entities
- RBAC Seeding Infrastructure
- Load Test Data Seeding
- RBAC Role API
- Subscription Plan Seeding
- Product Image Storage Migration
- Token Version Migrations
- Tenant Identity Utilities
- Role Management Endpoints
- Address Persistence Operations
- Authenticated Controller Requests
- Shopping Cart API
- Shopping Cart Operations
- Category Management Endpoints
- Order Refund Processing
- RBAC Permission API
- Subscription Plan Definitions
- Seeding Execution Orchestration
- Subscription Plan Management
- Coupon Input Validation
- Controller Route Templates
- Currency Change Workflow
- Store Currency Requests
- Order Response Serialization
- Order Service Test Utilities
- Subscription Feature Definitions
- Order Query and Numbering
- Jest Test Configuration
- HTTP Response Caching
- Service Health Monitoring
- Order Status Refunds
- Environment Configuration Validation
- Product Image Optimization
- Product Slug Generation
- API Request Pipeline
- Currency Change Requests
- Linting Configuration
- Tenant Provisioning Migration
- Stripe Account State Migration
- Customer Address Entity
- Currency Request Entity
- Email OTP Endpoints
- Catalog Entitlement Workflows
- TypeORM Compiler Configuration
- Authentication Token Lifecycle
- Cache Service Test Infrastructure
- Checkout Input Validation
- Order Item Entity
- Super Admin Seeding
- Nest Build Configuration
- API Architecture Documentation
- R2 Storage Health Checks
- Initial Platform Migration
- Subscription Refund Migration
- Initial Tenant Schema Migration
- Order Refund Migration
- Tenant Provisioning and RBAC
- Cart and Address Workflows
- Public Storefront Catalog
- Currency Review Validation
- Seeding Command Line
- Application Bootstrap Infrastructure
- Database Migration Operations
- Currency Approval Workflow
- Order Permission Keys
- Payment Facade Testing
- Cache Integration Test Harness
- RBAC Service Testing
- Subscription Backfill Seeding
- Tenant Architecture Workflows
- Primary Product Image Selection
- TypeScript Build Configuration
- Cache Header Test Guard
- Dashboard Statistics Types
- Stripe Refund Recovery

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 178 edges
2. `TenantRef` - 154 edges
3. `typeorm` - 122 edges
4. `Tenant` - 90 edges
5. `TenantManagerService` - 79 edges
6. `RequestWithUser` - 78 edges
7. `Permissions` - 75 edges
8. `TenantService` - 70 edges
9. `IENV` - 67 edges
10. `RoleKey` - 57 edges

## Surprising Connections (you probably didn't know these)
- `Known Limitations` --conceptually_related_to--> `Platform and Tenant Migration Tracks`  [AMBIGUOUS]
  README.md → src/database/MIGRATIONS.md
- `Dashboard Graceful Degradation` --semantically_similar_to--> `Tenant-Aware Redis Response Cache`  [INFERRED] [semantically similar]
  src/modules/dashboard/workflow.md → AGENTS.md
- `run()` --calls--> `TenantManagerService`  [EXTRACTED]
  test/verify-typeorm-migrations.ts → src/modules/tenants/services/tenant-manager.service.ts
- `run()` --calls--> `TenantMigrationService`  [EXTRACTED]
  test/verify-typeorm-migrations.ts → src/modules/tenants/services/tenant-migration.service.ts
- `Authentication and Authorization` --references--> `Authentication Pipeline`  [EXTRACTED]
  README.md → src/modules/auth/workflow.md

## Import Cycles
- 3-file cycle: `src/modules/coupons/entities/coupon-redemption.entity.ts -> src/modules/orders/entities/order.entity.ts -> src/modules/coupons/entities/coupon.entity.ts -> src/modules/coupons/entities/coupon-redemption.entity.ts`

## Hyperedges (group relationships)
- **Global Request Pipeline** — workflow_tenant_middleware, workflow_tenant_guard, workflow_jwt_guard, workflow_permission_guard, workflow_subscription_guard, workflow_throttler_guard, workflow_validation_serialization, workflow_tenant_repository_access [EXTRACTED 1.00]
- **Secure Tenant OTP Flow** — src_modules_email_otp_workflow_anti_enumeration_request, src_modules_email_otp_workflow_atomic_verification, src_modules_email_otp_workflow_challenge_lifecycle, src_modules_email_otp_workflow_hmac_security, src_modules_email_otp_workflow_purpose_routing [EXTRACTED 1.00]
- **Stripe Payment Processing Flow** — src_modules_payments_workflow_compatibility_facade, src_modules_payments_workflow_order_payment_intent, src_modules_payments_workflow_subscription_payment_intent, src_modules_payments_workflow_webhook_dispatch, src_modules_payments_workflow_durable_order_refunds, src_modules_payments_workflow_durable_subscription_refunds, src_modules_payments_workflow_stripe_connect [EXTRACTED 1.00]
- **Tenant Users Request Flow** — src_modules_users_workflow_global_user_request_pipeline, src_modules_users_workflow_userscontroller, src_modules_users_workflow_usersservice, src_modules_users_workflow_tenant_context_resolution, src_modules_users_workflow_tenantmanagerservice_getrepository, src_modules_users_workflow_tenant_user_schema [EXTRACTED 1.00]
- **Normalized User Presentation Contract** — src_modules_users_workflow_presentuser, src_modules_users_workflow_normalized_user_response, src_modules_users_workflow_role_identity_projection, src_modules_users_workflow_direct_permission_projection [EXTRACTED 1.00]
- **User Authorization Mutation Governance** — src_modules_users_workflow_assignrole, src_modules_users_workflow_deassignrole, src_modules_users_workflow_grantpermissions, src_modules_users_workflow_revokepermissions, src_modules_users_workflow_role_rank_enforcement, src_modules_users_workflow_actor_permission_ownership, src_modules_users_workflow_seed_role_permissions [EXTRACTED 1.00]

## Communities (156 total, 45 thin omitted)

### Community 0 - "Authentication and Cache Pipeline"
Cohesion: 0.04
Nodes (39): @nestjs/common, @nestjs/core, @nestjs/jwt, nestjs-pino, @nestjs/throttler, supertest, CACHE_POLICIES, CACHE_STORE (+31 more)

### Community 1 - "Subscription Lifecycle Management"
Cohesion: 0.05
Nodes (21): Subscription, asArray(), buildFakeDs(), Row, FREE_PLAN_SLUG, SUBSCRIPTION_LIFECYCLE_INTERVAL_MS, SUBSCRIPTION_REFUND_WINDOW_DAYS, SUBSCRIPTION_SORTABLE_FIELDS (+13 more)

### Community 2 - "Application Configuration Services"
Cohesion: 0.05
Nodes (37): @nestjs/config, CacheModule, CACHEABLE_ROUTES, CachePolicyDefinition, resolveCacheTtlMs(), ConfigEnv(), EmailProvider, IAPP (+29 more)

### Community 3 - "Order Payments and Refunds"
Cohesion: 0.06
Nodes (23): typeorm, moneyColumn, moneyColumnWithDefault(), restoreCouponUsage(), Order, PaymentStatus, CANCELED, FAILED (+15 more)

### Community 4 - "Tenant Provisioning and Management"
Cohesion: 0.05
Nodes (26): bcrypt, build(), compareMock, dto, hashMock, StoreProvisioningResult, StoreProvisioningService, StripeMock (+18 more)

### Community 5 - "Application Module Composition"
Cohesion: 0.05
Nodes (25): AppModule, R2Module, CoreModule, AuthModule, CartModule, CategoriesModule, CouponsModule, CurrencyRequestsModule (+17 more)

### Community 6 - "Subscription Payment Refunds"
Cohesion: 0.08
Nodes (16): @nestjs/typeorm, RefundStatus, FAILED, PENDING, PROCESSING, SUCCEEDED, buildMocks(), paidPayment() (+8 more)

### Community 7 - "TypeORM Migration Configuration"
Cohesion: 0.08
Nodes (36): reflect-metadata, IDB, build(), db, entities, TypeOrmDailyLogger, buildDataSourceOptions(), DataSourceOverrides (+28 more)

### Community 8 - "Permission Definitions and Seeding"
Cohesion: 0.06
Nodes (35): PermissionKey, AddressPermissionKey, CREATE, DELETE, READ, UPDATE, PermissionGuard, buildGuard() (+27 more)

### Community 9 - "Tenant Database Provisioning"
Cohesion: 0.07
Nodes (19): TenantManagerService, TenantMigrationResult, TenantMigrationService, TenantProvisionerService, buildOptionsMock, DataSourceMock, FakeDataSource, fakeRepo (+11 more)

### Community 10 - "Development Dependencies"
Cohesion: 0.06
Nodes (47): author, description, devDependencies, eslint@^9.39.5, eslint-config-prettier@^10.1.8, @eslint/eslintrc@^3.3.6, jest@^30.4.2, @nestjs/cli@^11.0.24 (+39 more)

### Community 11 - "Tenant Authentication Context"
Cohesion: 0.07
Nodes (27): logger, IOtp, buildService(), compareMock, config, hashMock, jwt, jwtConfig (+19 more)

### Community 12 - "Payment API Facade"
Cohesion: 0.08
Nodes (9): PaymentPermissionKey, CREATE, MANAGE, READ, StripeAccountStatus, CreatePaymentDto, PaymentsController, mockStripePaymentService (+1 more)

### Community 13 - "Runtime Package Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, @aws-sdk/client-s3@^3.1131.0, bcrypt@^5.1.1, class-transformer@^0.5.1, class-validator@^0.15.1, compression@^1.8.2, dotenv@^17.4.2, helmet@^8.3.0 (+32 more)

### Community 14 - "Email Delivery Transports"
Cohesion: 0.10
Nodes (16): IEmail, EmailModule, EmailService, SendOtpEmailParams, buildOtpEmail(), formatExpiry(), OtpEmailContent, OtpEmailParams (+8 more)

### Community 15 - "Platform Payment Administration"
Cohesion: 0.09
Nodes (5): PauseToggleDto, PlatformPaymentsController, PlatformPaymentsService, mockPlatformPaymentsService, buildMocks()

### Community 16 - "Stripe Webhook Infrastructure"
Cohesion: 0.09
Nodes (14): stripe, IStripe, StripeWebhookEventStatus, FAILED, PENDING, PROCESSED, PROCESSING, StripeWebhookEvent (+6 more)

### Community 17 - "Subscription Entitlement Enforcement"
Cohesion: 0.16
Nodes (3): SubscriptionEntitlementsService, buildMocks(), TenantRef

### Community 18 - "Build and Migration Scripts"
Cohesion: 0.06
Nodes (34): scripts, build, dev, format, lint, migrate:stripe-webhooks, migration:generate:platform, migration:generate:tenant (+26 more)

### Community 19 - "Subscription Usage Tracking"
Cohesion: 0.08
Nodes (13): UsageMetric, COUPONS_PER_MONTH, TenantUsageCounter, currentUtcPeriodStart(), STORE_ADMIN_ROLE_KEYS, SubscriptionUsageService, UsageSummary, UsageValue (+5 more)

### Community 20 - "Coupon API Validation"
Cohesion: 0.14
Nodes (10): class-transformer, class-validator, COUPON_CODE_MESSAGE, COUPON_CODE_REGEX, MAX_COUPON_CODE_LENGTH, normalizeCouponCodeValue(), UpdateCouponDto, UpdateCouponStatusDto (+2 more)

### Community 21 - "Platform Authorization Controls"
Cohesion: 0.15
Nodes (13): ROLE_RANK, RoleKey, ADMIN, CUSTOMER, STORE_OWNER, SUPER_ADMIN, Platform(), Roles (+5 more)

### Community 22 - "User Administration Endpoints"
Cohesion: 0.09
Nodes (7): AssignPermissionsDto, AssignRoleDto, RevokePermissionsDto, UpdateUserDto, pipe, mockUsersService, PartialUser

### Community 23 - "Address Module API"
Cohesion: 0.11
Nodes (8): AddressesModule, MAX_ADDRESSES, CreateAddressDto, UpdateAddressDto, mockAddressesService, buildMocks(), NOW, TENANT

### Community 24 - "Tenant Seeding and Policy"
Cohesion: 0.11
Nodes (16): ISeeding, SeederScope, PLATFORM, TENANT, EnvironmentScoped, RunPlatformOptions, RunTenantsOptions, SeederFailure (+8 more)

### Community 25 - "Subscription Payment Intents"
Cohesion: 0.12
Nodes (10): toMajorUnit(), toMinorUnit(), subscriptionPaymentMetaData, CreateSubDto, BillingInterval, MONTHLY, YEARLY, AssignSubscriptionDto (+2 more)

### Community 26 - "Category Catalog Services"
Cohesion: 0.12
Nodes (9): CategoriesService, serializeCategory(), SerializedCategory, StorefrontCategoryOption, buildMocks(), SerializedImage, SerializedProduct, serializeProduct() (+1 more)

### Community 27 - "User and OTP Entities"
Cohesion: 0.07
Nodes (6): VerifiedOtp, OtpChallenge, User, PermissionSummary, RoleSummary, UserResponse

### Community 28 - "Order Management API"
Cohesion: 0.12
Nodes (7): ListOrdersQueryDto, UpdateOrderStatusDto, ALLOWED_TRANSITIONS, ManageOrderService, OrdersController, mockManageOrderService, mockOrdersService

### Community 29 - "Subscription Plan Administration"
Cohesion: 0.12
Nodes (3): PlatformSubscriptionPlansController, SubscriptionPlansService, buildMocks()

### Community 30 - "User Management Workflow"
Cohesion: 0.12
Nodes (28): Actor Permission Ownership, assignRole, Bcrypt Password Hashing, Creatable Role Policy, create, deassignRole, Direct Permission Projection, Effective Authorization Permission Union (+20 more)

### Community 31 - "Stripe Connect Onboarding"
Cohesion: 0.10
Nodes (10): buildCorsOrigin(), CorsOriginDelegate, hostnameFromOrigin(), HTTP_PROTOCOLS, isRootDomainOrigin(), normalizeRootDomain(), Delegate, bootstrap() (+2 more)

### Community 32 - "Subscription Entitlement Guards"
Cohesion: 0.14
Nodes (15): SubscriptionLimitKey, COUPONS_PER_MONTH, DATABASE_BYTES, PRODUCTS, STORAGE_BYTES, STORE_ADMINS, REQUIRE_ACTIVE_SUBSCRIPTION, RequireActiveSubscription() (+7 more)

### Community 33 - "Product API Validation"
Cohesion: 0.09
Nodes (6): FALLBACK_MAX_FILE_SIZE, CreateProductDto, SKU_MESSAGE, SKU_REGEX, ReorderImagesDto, UpdateProductDto

### Community 34 - "Platform Tenant Administration"
Cohesion: 0.10
Nodes (6): @nestjs/testing, mockStripePaymentService, mockPlatformTenantsService, buildMocks(), PlatformTenantsController, PlatformTenantsService

### Community 35 - "Shopping Cart Management"
Cohesion: 0.13
Nodes (11): MAX_CART_ITEM_QUANTITY, MAX_CART_ITEMS, SerializedCartItem, CartPermissionKey, CREATE, DELETE, READ, UPDATE (+3 more)

### Community 36 - "Product Catalog Entities"
Cohesion: 0.08
Nodes (4): Category, Product, ProductImage, product()

### Community 37 - "TypeScript Compiler Configuration"
Cohesion: 0.07
Nodes (26): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+18 more)

### Community 38 - "Shopping Cart Entities"
Cohesion: 0.10
Nodes (5): Cart, CartItem, buildMocks(), NOW, TENANT

### Community 39 - "Product Query Validation"
Cohesion: 0.08
Nodes (4): PRODUCT_SORTABLE_FIELDS, ListProductsQueryDto, PriceRangeConstraint, pipe

### Community 40 - "Coupon Discount Logic"
Cohesion: 0.16
Nodes (17): round2(), CouponApplication, CouponSnapshot, SerializedCouponValidation, DiscountType, FIXED_AMOUNT, PERCENTAGE, COUPON_SORTABLE_FIELDS (+9 more)

### Community 41 - "Order Payment Processing"
Cohesion: 0.15
Nodes (5): paymentMetaData, buildMocks(), OrderPaymentIntentService, OrderPaymentService, OrderPaymentStatusService

### Community 43 - "Tenant Cache Infrastructure"
Cohesion: 0.19
Nodes (5): CachePolicyName, CacheScope, CACHE_RESPONSE, CacheResponseMetadata, TenantCacheService

### Community 44 - "Currency Change Validation"
Cohesion: 0.12
Nodes (12): CURRENCIES, Currency, AED, AUD, CAD, EGP, EUR, GBP (+4 more)

### Community 46 - "Seeding Module Registry"
Cohesion: 0.22
Nodes (9): PLATFORM_SEEDERS, SeederOrder, TENANT_SEEDERS, PlatformSeeder, SeederContext, NamedSeeder, PlatformPermissionsSeeder, PlatformRolesSeeder (+1 more)

### Community 49 - "User Access Administration"
Cohesion: 0.22
Nodes (3): Permissions, presentUser(), UsersController

### Community 50 - "RBAC Roles and Permissions"
Cohesion: 0.16
Nodes (7): Permission, RbacModule, mergePermissions(), buildMocks(), DTO, permissionObjects(), TENANT

### Community 51 - "Paginated List Queries"
Cohesion: 0.10
Nodes (3): PaginationQueryDto, ListCouponsQueryDto, ListUsersQueryDto

### Community 52 - "Cloud Object Storage"
Cohesion: 0.11
Nodes (8): R2Service, buildService(), buildServiceWithR2(), ClientOptions, filesConfig, mockOptimize, mockSend, r2Config

### Community 53 - "Transactional Commerce Workflows"
Cohesion: 0.10
Nodes (12): Coupon Management Workflow, Coupon Discount Rules, OTP Challenge Lifecycle, Email OTP Ownership Boundary, OTP Purpose Routing, Order Status Lifecycle, Transactional Checkout, StripePaymentService Compatibility Facade (+4 more)

### Community 55 - "Coupon Validation and Consumption"
Cohesion: 0.25
Nodes (4): normalizeCouponCode(), SerializedCoupon, CouponsService, serializeCoupon()

### Community 56 - "Email OTP Contracts"
Cohesion: 0.16
Nodes (9): OtpPurpose, EMAIL_VERIFICATION, PASSWORD_RESET, SENSITIVE_ACTION, RequestOtpDto, VerifyOtpDto, RequestOtpInput, VerifyOtpInput (+1 more)

### Community 57 - "Redis Cache Infrastructure"
Cohesion: 0.15
Nodes (7): ioredis@^6.0.0, ioredis, RedisCacheStore, build(), CACHE, fakeClient(), logger

### Community 58 - "Cache Route Decoration"
Cohesion: 0.15
Nodes (8): rxjs@^7.8.2, rxjs, CacheResponse(), ApprovedPublicController, ApprovedTenantController, build(), PlainController, UnapprovedController

### Community 60 - "Permission Management API"
Cohesion: 0.16
Nodes (12): RbacPermissionKey, PERMISSIONS_CREATE, PERMISSIONS_DELETE, PERMISSIONS_READ, PERMISSIONS_UPDATE, ROLES_CREATE, ROLES_DELETE, ROLES_READ (+4 more)

### Community 61 - "Product Catalog Operations"
Cohesion: 0.30
Nodes (3): ProductsService, buildMocks(), resolveTenantScope()

### Community 62 - "Pagination and Sorting"
Cohesion: 0.21
Nodes (15): clampLimit(), DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT, SortOrderValue, isPaginatedQuery(), PaginationInput, ResolvedPagination (+7 more)

### Community 63 - "Authentication Service Flows"
Cohesion: 0.17
Nodes (3): AuthService, LoginUserDto, TenantIdentity

### Community 64 - "Category Management API"
Cohesion: 0.17
Nodes (8): CategoryPermissionKey, CREATE, DELETE, READ, UPDATE, CreateCategoryDto, UpdateCategoryDto, mockCategoriesService

### Community 65 - "Tenant Data Seeding"
Cohesion: 0.19
Nodes (7): TENANT_ROLE_KEYS, TenantSeeder, TenantSeederContext, BASE_CATEGORIES, CategoriesSeeder, TenantPermissionsSeeder, TenantRolesSeeder

### Community 66 - "Subscription Lifecycle States"
Cohesion: 0.13
Nodes (14): SubscriptionStatus, ACTIVE, CANCELED, INCOMPLETE, INCOMPLETE_EXPIRED, PAST_DUE, PAUSED, TRIALING (+6 more)

### Community 68 - "Seeder Registry"
Cohesion: 0.13
Nodes (5): pick(), SeederRegistry, sortSeeders(), validateSeeders(), build()

### Community 69 - "Authentication API Validation"
Cohesion: 0.18
Nodes (3): ConfirmPasswordResetDto, RefreshTokenDto, mockAuthService

### Community 72 - "Order Lifecycle Operations"
Cohesion: 0.29
Nodes (5): SerializedOrder, findOrderForUpdate(), restockOrderItems(), transitionOrderStatus(), OrdersService

### Community 73 - "Dashboard Metrics API"
Cohesion: 0.19
Nodes (6): DashboardController, DashboardModule, DashboardService, mockDashboardService, buildMocks(), TENANT

### Community 74 - "Email OTP Security"
Cohesion: 0.19
Nodes (10): EmailOtpService, buildHarness(), config, Harness, makeChallenge(), otpConfig, TENANT, generateOtpCode() (+2 more)

### Community 75 - "Subscription Plan Input Validation"
Cohesion: 0.15
Nodes (3): CreateSubscriptionPlanDto, SubscriptionPlanFeatureDto, SubscriptionPlanLimitDto

### Community 76 - "System Architecture Documentation"
Cohesion: 0.12
Nodes (8): Email OTP Security, SaaS Store API Architecture Reference, Tenant Storage Accounting, Subscription Entitlement Enforcement, Tenant DataSource LRU, Tenant Dashboard Statistics, Tenant Active-State Toggle, Platform Tenant Inspection

### Community 79 - "RBAC Seeding Infrastructure"
Cohesion: 0.17
Nodes (11): BootstrapSuperAdminOptions, logger, RepositoryHost, seedRbac(), SeedRbacOptions, upsertPermissions(), upsertRoles(), upsertPermissionsMock (+3 more)

### Community 80 - "Load Test Data Seeding"
Cohesion: 0.21
Nodes (15): assert(), DEFAULT_TENANTS, ensureUser(), indexLine(), main(), ownerEmail(), parseTenants(), positiveInt() (+7 more)

### Community 81 - "RBAC Role API"
Cohesion: 0.26
Nodes (6): @nestjs/mapped-types@^2.1.1, @nestjs/mapped-types, CreateRoleDto, UpdateRoleDto, SYSTEM_ROLES, mockRbacService

### Community 82 - "Subscription Plan Seeding"
Cohesion: 0.23
Nodes (9): isUniqueViolation(), withUniqueRetry(), RepositoryHost, seedSubscriptionPlans(), syncFeatures(), syncLimits(), upsertPlan(), SubscriptionPlansSeeder (+1 more)

### Community 83 - "Product Image Storage Migration"
Cohesion: 0.20
Nodes (4): ColumnRow, ReconcileProductImageStorage1795125000001, TenantStorageRow, AddProductImageSizes1795125000000

### Community 85 - "Tenant Identity Utilities"
Cohesion: 0.21
Nodes (6): CreateTenantDto, buildSchemaName(), resolveSubdomain(), sanitizeSchemaName(), SLUG_MESSAGE, SLUG_REGEX

### Community 87 - "Address Persistence Operations"
Cohesion: 0.33
Nodes (3): AddressesService, serializeAddress(), SerializedAddress

### Community 94 - "Subscription Plan Definitions"
Cohesion: 0.16
Nodes (11): ALL_FEATURES, FREE_FEATURES, GROWTH_FEATURES, PLAN_SEEDS, PlanLimitSeed, PlanSeed, PRO_FEATURES, STARTER_FEATURES (+3 more)

### Community 95 - "Seeding Execution Orchestration"
Cohesion: 0.24
Nodes (3): SeedingBootstrapService, SeedingService, build()

### Community 96 - "Subscription Plan Management"
Cohesion: 0.30
Nodes (4): ListSubscriptionPlansQueryDto, UpdateSubscriptionPlanDto, PLAN_RELATIONS, mockPlansService

### Community 98 - "Controller Route Templates"
Cohesion: 0.24
Nodes (12): buildRouteTemplate(), ControllerRouteHandler, firstPath(), getRouteTemplate(), joinRoutePath(), listControllerRouteHandlers(), listControllerRoutes(), METHOD_NAMES (+4 more)

### Community 99 - "Currency Change Workflow"
Cohesion: 0.22
Nodes (9): RequestActor, CurrencyChangeRequestStatus, APPROVED, CANCELLED, PENDING, REJECTED, ACTOR, buildMocks() (+1 more)

### Community 101 - "Order Response Serialization"
Cohesion: 0.24
Nodes (8): SerializedDeliveryAddress, SerializedOrderCoupon, SerializedOrderItem, serializeDeliveryAddress(), serializeOrder(), serializeOrderItem(), NOW, r2

### Community 102 - "Order Service Test Utilities"
Cohesion: 0.37
Nodes (10): buildMocks(), buildOrderRaceMocks(), customerCart(), defaultAddress(), manager(), NOW, orderEntity(), product() (+2 more)

### Community 103 - "Subscription Feature Definitions"
Cohesion: 0.15
Nodes (13): PlanFeatureSeed, SubscriptionFeatureKey, ADVANCED_ANALYTICS, ADVANCED_REPORTS, AUDIT_LOGS, COUPONS, CUSTOM_DOMAIN, PRIORITY_SUPPORT (+5 more)

### Community 104 - "Order Query and Numbering"
Cohesion: 0.21
Nodes (10): RFC-4648, PaginatedResult, ORDER_NUMBER_ALPHABET, ORDER_NUMBER_PREFIX, ORDER_NUMBER_RETRIES, ORDER_NUMBER_SUFFIX_LENGTH, MANAGER_CANCELLABLE_STATUSES, ORDER_SORTABLE_FIELDS (+2 more)

### Community 105 - "Jest Test Configuration"
Cohesion: 0.17
Nodes (12): jest, collectCoverageFrom, coverageDirectory, coverageReporters, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment (+4 more)

### Community 107 - "Service Health Monitoring"
Cohesion: 0.20
Nodes (3): HealthController, buildController(), CACHE

### Community 108 - "Order Status Refunds"
Cohesion: 0.18
Nodes (10): OrderStatus, CANCELLED, CONFIRMED, DELIVERED, PENDING, PROCESSING, RETURN_REQUESTED, RETURNED (+2 more)

### Community 109 - "Environment Configuration Validation"
Cohesion: 0.22
Nodes (6): joi@^18.2.3, joi, EnvSchema, PLACEHOLDER_SECRETS, baseEnv(), validate()

### Community 110 - "Product Image Optimization"
Cohesion: 0.22
Nodes (5): ImagePreset, OptimizedImage, QUALITY_LEVELS, R2ImageOptimizerService, SCALE_LEVELS

### Community 111 - "Product Slug Generation"
Cohesion: 0.38
Nodes (7): slugify(), buildProductSlugBase(), ensureUniqueProductSlug(), sanitizeSeed(), slugifyProductName(), SlugOwner, withSlugSuffix()

### Community 112 - "API Request Pipeline"
Cohesion: 0.20
Nodes (10): High-Level Architecture, API Request Pipeline, JwtGuard, PermissionGuard, SubscriptionGuard, TenantGuard, TenantMiddleware, Tenant Repository Access (+2 more)

### Community 114 - "Linting Configuration"
Cohesion: 0.22
Nodes (8): @eslint/js@^9.39.5, eslint-plugin-prettier@^5.5.6, globals@^16.5.0, typescript-eslint@^8.66.0, @eslint/js, eslint-plugin-prettier, globals, typescript-eslint

### Community 121 - "Catalog Entitlement Workflows"
Cohesion: 0.22
Nodes (9): Product Catalog Workflow, R2 Product Image Lifecycle, Product Image Storage Quota, Unique Product Slugs, Subscription Entitlement Enforcement, Subscription Lifecycle Worker, Subscription Plan Management, Seeded Subscription Plans (+1 more)

### Community 122 - "TypeORM Compiler Configuration"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, resolvePackageJsonExports, extends, ./tsconfig.json, ts-node, transpileOnly

### Community 123 - "Authentication Token Lifecycle"
Cohesion: 0.32
Nodes (8): Authentication and Authorization, Authentication Pipeline, Credential Issuance, Logout Token Revocation, Platform Login, Refresh Token Rotation, Resumable Store Registration, Tenant Login

### Community 124 - "Cache Service Test Infrastructure"
Cohesion: 0.25
Nodes (3): build(), buildConfig(), FakeCacheStore

### Community 127 - "Super Admin Seeding"
Cohesion: 0.29
Nodes (3): ensureBootstrapSuperAdmin(), SuperAdminSeeder, ensureMock

### Community 128 - "Nest Build Configuration"
Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, plugins, $schema, sourceRoot

### Community 129 - "API Architecture Documentation"
Cohesion: 0.29
Nodes (7): Caching and Performance, Database Design, Known Limitations, REST API Conventions, SaaS Commerce API, Security and Operations, Testing Strategy

### Community 135 - "Tenant Provisioning and RBAC"
Cohesion: 0.33
Nodes (6): Tenant Migration Runner, Platform RBAC Seeding, Seeded Role-Permission Matrix, Tenant RBAC Management, Tenant RBAC Seeding, Per-Schema DataSource Cache

### Community 136 - "Cart and Address Workflows"
Cohesion: 0.29
Nodes (4): Address Management Workflow, One Default Address Constraint, Cart Quantity and Line Limits, Cart Management Workflow

### Community 137 - "Public Storefront Catalog"
Cohesion: 0.29
Nodes (4): Category Management Workflow, Filtered Product Listing, Public Storefront Projection, Server Component Catalog Loading

### Community 139 - "Seeding Command Line"
Cohesion: 0.43
Nodes (6): CliArgs, main(), parseArgs(), resolveMode(), SeedMode, splitList()

### Community 140 - "Application Bootstrap Infrastructure"
Cohesion: 0.33
Nodes (6): Application Bootstrap, Configuration Validation, HTTP Security Setup, Application and TypeORM Logging, Public TypeORM DataSource, Tenant DataSource Reuse

### Community 141 - "Database Migration Operations"
Cohesion: 0.33
Nodes (3): Migration Generation Workflow, Platform and Tenant Migration Tracks, Migration Verification

### Community 142 - "Currency Approval Workflow"
Cohesion: 0.33
Nodes (5): Currency Change Workflow, Platform Currency Approval, Platform Currency Review, Platform Payment Oversight, Platform Administration Scope

### Community 143 - "Order Permission Keys"
Cohesion: 0.33
Nodes (6): OrderPermissionKey, CANCEL, CREATE, MANAGE, READ, RETURN

### Community 144 - "Payment Facade Testing"
Cohesion: 0.33
Nodes (5): connect, orderPayments, subscriptionPayments, tenants, webhooks

### Community 148 - "RBAC Service Testing"
Cohesion: 0.50
Nodes (4): makeRepo(), MockRepo, service(), TENANT

### Community 150 - "Tenant Architecture Workflows"
Cohesion: 0.50
Nodes (4): Multi-Tenant Architecture, Tenant Registry Operations, Tenant Storage Accounting, Tenant Resolution Workflow

### Community 152 - "TypeScript Build Configuration"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

## Ambiguous Edges - Review These
- `Known Limitations` → `Platform and Tenant Migration Tracks`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **175 isolated node(s):** `SUPER_ADMIN`, `STORE_OWNER`, `ADMIN`, `CUSTOMER`, `USD` (+170 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1239 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `Authentication and Cache Pipeline` to `Subscription Lifecycle Management`, `Application Configuration Services`, `Order Payments and Refunds`, `Tenant Provisioning and Management`, `Application Module Composition`, `Subscription Payment Refunds`, `Permission Definitions and Seeding`, `Tenant Database Provisioning`, `Development Dependencies`, `Tenant Authentication Context`, `Payment API Facade`, `Runtime Package Dependencies`, `Email Delivery Transports`, `Stripe Webhook Infrastructure`, `Subscription Usage Tracking`, `Coupon API Validation`, `Platform Authorization Controls`, `RBAC Service Testing`, `Address Module API`, `Tenant Seeding and Policy`, `Subscription Payment Intents`, `User Administration Endpoints`, `Order Management API`, `Subscription Entitlement Guards`, `Product API Validation`, `Shopping Cart Management`, `Shopping Cart Entities`, `Product Query Validation`, `Coupon Discount Logic`, `Tenant Cache Infrastructure`, `Seeding Module Registry`, `RBAC Roles and Permissions`, `Email OTP Contracts`, `Cache Route Decoration`, `Permission Management API`, `Category Management API`, `Tenant Data Seeding`, `Authentication API Validation`, `Dashboard Metrics API`, `Email OTP Security`, `RBAC Seeding Infrastructure`, `RBAC Role API`, `Subscription Plan Management`, `Controller Route Templates`, `Currency Change Workflow`, `Order Response Serialization`, `Order Service Test Utilities`, `Order Query and Numbering`, `Product Image Optimization`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **What connects `SUPER_ADMIN`, `STORE_OWNER`, `ADMIN` to the rest of the system?**
  _175 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Authentication and Cache Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.044158415841584156 - nodes in this community are weakly interconnected._
- **Why does `typeorm` connect `Order Payments and Refunds` to `Authentication and Cache Pipeline`, `Subscription Lifecycle Management`, `Application Configuration Services`, `Initial Platform Migration`, `Subscription Refund Migration`, `Initial Tenant Schema Migration`, `Order Refund Migration`, `TypeORM Migration Configuration`, `Tenant Provisioning and Management`, `Subscription Payment Refunds`, `Development Dependencies`, `Tenant Authentication Context`, `Permission Definitions and Seeding`, `Runtime Package Dependencies`, `Tenant Database Provisioning`, `Stripe Webhook Infrastructure`, `Subscription Usage Tracking`, `Address Module API`, `Tenant Seeding and Policy`, `Subscription Payment Intents`, `Application Module Composition`, `Order Management API`, `Shopping Cart Management`, `Shopping Cart Entities`, `Coupon Discount Logic`, `Seeding Module Registry`, `RBAC Roles and Permissions`, `Pagination and Sorting`, `Tenant Data Seeding`, `RBAC Seeding Infrastructure`, `RBAC Role API`, `Subscription Plan Seeding`, `Product Image Storage Migration`, `Token Version Migrations`, `Subscription Plan Management`, `Currency Change Workflow`, `Order Response Serialization`, `Order Query and Numbering`, `Service Health Monitoring`, `Tenant Provisioning Migration`, `Stripe Account State Migration`, `Super Admin Seeding`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Should `Subscription Lifecycle Management` be split into smaller, more focused modules?**
  _Cohesion score 0.04647160068846816 - nodes in this community are weakly interconnected._
- **Why does `TenantRef` connect `Subscription Entitlement Enforcement` to `Authentication and Cache Pipeline`, `Subscription Lifecycle Management`, `Application Configuration Services`, `Order Payments and Refunds`, `Tenant Provisioning and Management`, `TypeORM Migration Configuration`, `Tenant Database Provisioning`, `Tenant Authentication Context`, `Payment API Facade`, `Subscription Usage Tracking`, `Address Module API`, `Category Catalog Services`, `Order Management API`, `Subscription Entitlement Guards`, `Shopping Cart Management`, `Coupon Discount Logic`, `Order Payment Processing`, `Tenant Cache Infrastructure`, `RBAC Role Management`, `Subscription Assignment and Limits`, `User Authorization Management`, `Coupon Validation and Consumption`, `Email OTP Contracts`, `Product Catalog Operations`, `Pagination and Sorting`, `Authentication Service Flows`, `Store Registration Ownership`, `Order Lifecycle Operations`, `Dashboard Metrics API`, `RBAC Role API`, `Tenant Identity Utilities`, `Address Persistence Operations`, `Shopping Cart Operations`, `Order Refund Processing`, `Order Response Serialization`, `Order Query and Numbering`, `Order Status Refunds`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Known Limitations` and `Platform and Tenant Migration Tracks`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
