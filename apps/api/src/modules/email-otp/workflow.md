# email-otp — workflow

Ownership boundary:

- `EmailOtpService` (this module) owns **code generation, hashing, storage, throttling counters, and atomic consumption**. It knows nothing about what a purpose does.
- `AuthService` (`../auth`) owns **purpose routing and effects** (`markEmailVerified`, credential issuance, password update).
- `EmailService` (`../email`) owns **delivery** over the `EMAIL_TRANSPORT` seam.
- `OtpChallenge` is a **tenant** entity (`TENANT_ENTITIES`) — this flow is tenant-schema only. Platform (`SUPER_ADMIN`) OTP is out of scope.

All routes are `@Public()` but **not** `@Platform()`, so `TenantGuard` still runs and requires a resolvable ACTIVE tenant (`x-tenant-slug` / `x-tenant-id` / subdomain). The remaining global guards skip `@Public` routes; `ThrottlerGuard` still applies.

---

```mermaid
flowchart TD
    subgraph HTTP["HTTP entry points — AuthModule registers both controllers"]
        RQ["POST /api/v1/auth/email-otp/request<br/>@Public, tenant-scoped<br/>Throttle 5 / 60s"]
        VR["POST /api/v1/auth/email-otp/verify<br/>@Public, tenant-scoped<br/>Throttle 5 / 60s"]
        PR["POST /api/v1/auth/password-reset/confirm<br/>@Public, tenant-scoped (AuthController)<br/>Throttle 10 / 60s"]
        RG["POST /api/v1/auth/register<br/>@Public, tenant-scoped"]
    end

    RQ --> G["Global pipeline: TenantMiddleware → TenantGuard<br/>Jwt / EmailVerified / Permission / Subscription skip (@Public)<br/>ThrottlerGuard applies"]
    VR --> G
    PR --> G
    RG --> G

    G --> A1["AuthService.requestEmailOtp"]
    G --> A2["AuthService.verifyEmailOtp"]
    G --> A3["AuthService.confirmPasswordReset"]
    G --> A4["AuthService.register"]

    A1 --> S1["EmailOtpService.request"]
    A2 --> S2a{"purpose"}
    S2a -->|"PASSWORD_RESET"| E1["400 OTP_PURPOSE_REQUIRES_CONFIRM<br/>(checked before consumption)"]
    S2a -->|"SENSITIVE_ACTION"| E2["400 OTP_PURPOSE_NOT_SUPPORTED<br/>(checked before consumption)"]
    S2a -->|"EMAIL_VERIFICATION / LOGIN_MFA"| S2["EmailOtpService.verify"]
    A3 --> S3["EmailOtpService.verify<br/>purpose = PASSWORD_RESET"]
    A4 --> S4["EmailOtpService.request<br/>purpose = EMAIL_VERIFICATION<br/>(best-effort, errors logged)"]

    S2 --> F1{"purpose"}
    F1 -->|"EMAIL_VERIFICATION"| F1a["UsersService.markEmailVerified<br/>→ 200 { verified: true }"]
    F1 -->|"LOGIN_MFA"| F1b["AuthService.returnUserCredential<br/>→ access_token + refresh_token"]

    S3 --> F3["bcrypt.hash(newPassword, BCRYPT_ROUNDS)<br/>UsersService.updatePassword<br/>→ 200 { success: true }"]
```

`PASSWORD_RESET` codes must be confirmed through `/auth/password-reset/confirm`; `SENSITIVE_ACTION` is reserved and rejected. Both rejections happen **before** `EmailOtpService.verify`, so the challenge is not consumed and attempts are not incremented.

---

```mermaid
flowchart TD
    START["request({ email, purpose, tenant })"] --> T0["resolveTenantScope(tenant)<br/>missing context → 403 Tenant context is required"]
    T0 --> T1["ConfigService otp group"]

    T1 --> REPOS["TenantManagerService.getRepository<br/>OtpChallenge + User (tenant schema)"]
    REPOS --> U0{"user by email?"}
    U0 -->|"none"| OK0["return { success: true }<br/>anti-enumeration: no row, no email"]
    U0 -->|"found"| W0{"challenges for (userId, purpose)<br/>createdAt >= now - requestWindowSeconds<br/>>= maxRequests ?"}
    W0 -->|"yes"| OK1["return { success: true } (silent drop)"]
    W0 -->|"no"| C0{"latest challenge<br/>lastSentAt within resendCooldownSeconds ?"}
    C0 -->|"yes"| OK2["return { success: true } (cooldown)"]
    C0 -->|"no"| GEN["id = randomUUID()<br/>code = generateOtpCode(length)<br/>codeHash = HMAC-SHA256(hashSecret, '&lt;id&gt;:&lt;code&gt;')<br/>expiresAt = now + expirationSeconds"]

    GEN --> TX["transaction"]
    TX --> TX1["UPDATE otp_challenges<br/>SET consumedAt = now<br/>WHERE userId, purpose, consumedAt IS NULL"]
    TX1 --> TX2["INSERT new challenge<br/>attempts = 0, maxAttempts, requestCount = windowCount + 1<br/>lastSentAt = now, consumedAt = NULL"]
    TX2 --> RACE{"insert failed with unique violation 23505?"}
    RACE -->|"yes — concurrent request won<br/>the partial unique index"| OK3["return { success: true }<br/>no email sent"]
    RACE -->|"other error"| ERR["rethrow"]
    RACE -->|"inserted"| SEND["EmailService.sendOtpEmail<br/>to, code, purpose, expiresInSeconds<br/>storeName from AsyncLocalStorage tenant context"]

    SEND --> SENT{"delivery ok?"}
    SENT -->|"no"| LOG["log error<br/>response unchanged"]
    SENT -->|"yes"| OK4["return { success: true }"]
    LOG --> OK4
```

Response is **always** `200 { success: true }`: unknown email, throttled window, cooldown, lost race, and email-delivery failure are indistinguishable to the caller.

The per-user limits are independent of the HTTP throttle:

- HTTP: `@Throttle 5 / 60s` per route.
- Window cap: `OTP_MAX_REQUESTS` per `OTP_REQUEST_WINDOW_SECONDS` per `(userId, purpose)`.
- Cooldown: `OTP_RESEND_COOLDOWN_SECONDS` since the latest challenge's `lastSentAt`.

---

```mermaid
flowchart TD
    VSTART["verify({ email, purpose, code, tenant })"] --> V0["resolveTenantScope(tenant)<br/>missing context → 403"]
    V0 --> V1["user by email in tenant schema"]
    V1 --> VU{"user found?"}
    VU -->|"no"| VU1["400 OTP_INVALID"]
    VU -->|"yes"| VTX["transaction"]

    VTX --> L0["SELECT latest challenge<br/>WHERE userId, purpose<br/>ORDER BY createdAt DESC LIMIT 1<br/>FOR UPDATE (pessimistic_write)"]
    L0 --> L1{"challenge exists?"}
    L1 -->|"no"| E0["OTP_INVALID"]
    L1 -->|"yes"| L2{"consumedAt != null?"}
    L2 -->|"yes"| E1["OTP_ALREADY_USED"]
    L2 -->|"no"| L3{"expiresAt <= now?"}
    L3 -->|"yes"| E2["OTP_EXPIRED"]
    L3 -->|"no"| L4{"attempts >= maxAttempts?"}
    L4 -->|"yes"| E3["OTP_TOO_MANY_ATTEMPTS"]
    L4 -->|"no"| L5["verifyOtpCode:<br/>HMAC compare with timingSafeEqual"]

    L5 --> M{"matches?"}
    M -->|"no"| M1["attempts += 1 (atomic increment)<br/>OTP_INVALID"]
    M -->|"yes"| C1["UPDATE consumedAt = now<br/>challenge.consumedAt = now"]
    C1 --> RET["return { challenge, user }"]

    E0 --> ERR["throw 400 BadRequestException<br/>{ code, message }"]
    E1 --> ERR
    E2 --> ERR
    E3 --> ERR
    M1 --> ERR
```

The row lock serializes concurrent verifies: exactly one success consumes the challenge, and the rest see `OTP_ALREADY_USED`.

---

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: request creates a new challenge
    ACTIVE --> SUPERSEDED: newer request (consumedAt = now, no code accepted)
    ACTIVE --> CONSUMED: verify success (consumedAt = now)
    ACTIVE --> UNUSABLE: expiresAt passed or attempts >= maxAttempts
    SUPERSEDED --> [*]
    CONSUMED --> [*]
    UNUSABLE --> [*]

    note right of ACTIVE
        Partial unique index
        (userId, purpose) WHERE "consumedAt" IS NULL
        allows at most one ACTIVE row.
        Rows are never deleted; expiry and
        attempt exhaustion do not set consumedAt.
    end note
```

`OtpChallenge` (`otp_challenges`, tenant schema):

| Column | Notes |
| --- | --- |
| `id` | UUID generated in-app (part of the HMAC message) |
| `userId` / `user` | FK to tenant `user`, `ON DELETE CASCADE`, indexed |
| `email` | Snapshotted request email, indexed |
| `purpose` | `OtpPurpose` varchar |
| `codeHash` | hex HMAC-SHA256, never the plaintext code |
| `expiresAt`, `createdAt` | `timestamptz` |
| `attempts` / `maxAttempts` | incremented atomically on mismatch |
| `requestCount` | window count at creation (`windowCount + 1`) |
| `lastSentAt` | cooldown anchor |
| `consumedAt` | `NULL` = active; set by verify success or supersede |

Config (`otp` group, Joi-validated): `OTP_LENGTH` (default 6), `OTP_EXPIRATION_SECONDS` (600), `OTP_MAX_ATTEMPTS` (5), `OTP_RESEND_COOLDOWN_SECONDS` (60), `OTP_MAX_REQUESTS` (5), `OTP_REQUEST_WINDOW_SECONDS` (3600), required `OTP_HASH_SECRET`, `OTP_REQUIRE_EMAIL_VERIFIED` (false). Delivery uses `EMAIL_PROVIDER` = `smtp | log | memory`; `log` never writes the code.

## Errors

`otpError()` builds `400 BadRequestException` with `{ code, message }`:

| Code | When |
| --- | --- |
| `OTP_INVALID` | unknown email, no challenge, wrong code |
| `OTP_EXPIRED` | `expiresAt <= now` |
| `OTP_ALREADY_USED` | `consumedAt` set before verify |
| `OTP_TOO_MANY_ATTEMPTS` | `attempts >= maxAttempts` |
| `OTP_PURPOSE_REQUIRES_CONFIRM` | `PASSWORD_RESET` sent to `/auth/email-otp/verify` |
| `OTP_PURPOSE_NOT_SUPPORTED` | `SENSITIVE_ACTION` sent to `/auth/email-otp/verify` |

## Related behavior outside this module

- `AuthService.register` creates the CUSTOMER then calls `EmailOtpService.request(EMAIL_VERIFICATION)` best-effort; a failure is logged and registration still succeeds.
- `OTP_REQUIRE_EMAIL_VERIFIED=true` makes `POST /auth/login` reject unverified users with `401 { code: 'EMAIL_NOT_VERIFIED' }` before issuing credentials. Independently, `EmailVerifiedGuard` rejects every authenticated tenant route with `403 { code: 'EMAIL_NOT_VERIFIED' }` unless the route is `@Public`, `@Platform`, or `@AllowUnverifiedEmail()`.
- `LOGIN_MFA` can be requested and verified, but `POST /auth/login` does not issue an MFA challenge; a client must call the request route explicitly.
- Production schema changes for `otp_challenges` use the idempotent `test/migrate-otp-challenges.ts`; dev/staging rely on tenant `synchronize`.

## Validation

- `email-otp.service.spec.ts` — unknown email, supersede + send, cooldown, window cap, successful consumption, wrong code increments attempts, expired, already used, attempts cap, missing challenge, unknown email on verify.
- `otp-code.util.spec.ts` — code shape/zero-padding, per-challenge HMAC uniqueness, constant-time compare.
- `AuthService` spec covers purpose routing (`verifyEmailOtp` marks verified, `LOGIN_MFA` issues credentials, `PASSWORD_RESET` rejected before consumption).
