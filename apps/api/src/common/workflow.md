```mermaid
flowchart TD
    START["main.ts bootstrap<br/>NestFactory.create(AppModule, { rawBody: true })"] --> APP["AppModule"]
    APP --> CORE["CoreModule"]
    APP --> GUARDSWIRING["AppModule providers:<br/>APP_GUARD TenantGuard, JwtGuard, PermissionGuard, ThrottlerGuard<br/>TenantMiddleware applied to all routes"]
    APP --> MODS["Feature modules:<br/>Auth, Users, Rbac, Tenants, Platform,<br/>Products, Categories, Cart, Orders, Addresses,<br/>Dashboard, Payments, CurrencyRequests, Storefront"]
    CORE --> CFGMOD["ConfigModule.forRoot (global)<br/>Joi EnvSchema + ConfigEnv factory"]

    subgraph CFG["Configuration — config/"]
        ENV[".env / process.env"] --> JOI{"EnvSchema (Joi) validation<br/>on ConfigModule init"}
        JOI -->|"missing / invalid vars,<br/>secrets under 32 chars,<br/>placeholder secrets in production"| EXIT["process exits with env error"]
        JOI -->|"valid"| BENV["buildEnv() -> typed IENV groups:<br/>app, db, jwt, bcrypt, log, throttling,<br/>cors, r2, files, stripe"]
    end

    CFGMOD --> ENV

    subgraph LOGG["HTTP logging — logger/logger.module.ts"]
        PINO["nestjs-pino (AppLoggerModule)<br/>level from LOG_LEVEL<br/>redact authorization + cookie headers"]
        PINO --> APPLOG["rotating-file-stream<br/>logs/app/app-YYYY-MM-DD.log (daily)"]
    end
    CORE --> PINO

    subgraph DBL["Database — config/data-source.factory.ts"]
        DSF["buildDataSourceOptions<br/>postgres, host/port/credentials from db config,<br/>ssl, DB_LOGGING, DB_SYNCHRONIZE"]
        DSF --> TL["TypeOrmDailyLogger<br/>logs/typeorm/typeorm-YYYY-MM-DD.log (daily)<br/>shared single instance"]
    end
    CORE --> TYPEORM["TypeOrmModule.forRootAsync<br/>autoLoadEntities + DSF<br/>PUBLIC_ENTITIES = Tenant, User, Role, Permission,<br/>CurrencyChangeRequest"]
    TYPEORM --> DSF
    CORE --> JWTM["JwtModule (global)<br/>JWT_ACCESS_SECRET + JWT_ACCESS_EXPIRES_IN"]
    CORE --> THROTTLE["ThrottlerModule.forRootAsync<br/>ttl + limit from throttling config<br/>(default 20 req/min; login routes 5/min)"]
    CORE --> R2MOD["R2Module — R2Service (Cloudflare R2)"]
    CORE --> HEALTH["HealthController — GET /api/v1/health<br/>reports db + R2"]

    subgraph MAINSET["main.ts setup"]
        HELMET["helmet (CSP disabled for Swagger UI)"]
        CORS["CORS (origin allowlist + root-domain subdomains, credentials)"]
        SWAG["Swagger UI at /api/v1"]
        GPIPE["Global ValidationPipe<br/>whitelist + forbidNonWhitelisted + transform"]
        GINT["ClassSerializerInterceptor<br/>strips @Exclude fields"]
        PREFIX["Global prefix /api/v1"]
        SHUT["enableShutdownHooks()"]
        LISTEN["listen on APP_PORT"]
    end
    START --> HELMET
    START --> CORS
    START --> SWAG
    START --> GPIPE
    START --> GINT
    START --> PREFIX
    START --> SHUT
    START --> LISTEN

    subgraph RUNTIME["Runtime reuse"]
        TENDS["TenantManagerService reuses buildDataSourceOptions<br/>for per-tenant DataSources<br/>(schema override, TENANT_ENTITIES,<br/>synchronize = DB_SYNCHRONIZE AND (not production OR DB_SYNCHRONIZE_TENANTS),<br/>TENANT_POOL_SIZE, LRU cap 100)"]
        RK["constants: RoleKey + ROLE_RANK<br/>SUPER_ADMIN 5 -> CUSTOMER 0<br/>used by rank checks"]
        PK["constants: PermissionKey =<br/>UserPermissionKey | RbacPermissionKey |<br/>ProductPermissionKey | CategoryPermissionKey |<br/>CartPermissionKey | OrderPermissionKey |<br/>PaymentPermissionKey | AddressPermissionKey"]
    end
    DSF --> TENDS
```

`CurrencyChangeRequest` is a public-schema entity (each request references a tenant by id); all other commerce entities are tenant-scoped and only ever registered through `TENANT_ENTITIES`.
