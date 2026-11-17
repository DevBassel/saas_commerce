```mermaid
flowchart TD
    subgraph TENANT["Tenant routes — PaymentsController /api/v1/payments"]
        C["Client (tenant user)"] --> G["Global pipeline: TenantMiddleware → TenantGuard → JwtGuard →<br/>EmailVerifiedGuard → PermissionGuard → SubscriptionGuard → ThrottlerGuard"]
        G --> RO{"route"}
        RO -->|"POST /payments/stripe<br/>(authenticated; no @Permissions decorator)"| CP["createOrderPaymentIntent({ orderId }, req.user)<br/>returns clientSecret"]
        RO -->|"POST /payments/stripe/subscription<br/>needs subscriptions:manage"| CS["createSubscriptionPaymentIntent —<br/>platform PaymentIntent for a plan"]
        RO -->|"POST /payments/stripe/subscription/cancel<br/>needs subscriptions:manage"| CX["cancelOwnSubscription —<br/>refund latest PAID purchase (7-day window)<br/>+ downgrade to free"]
        RO -->|"GET /payments/stripe/account<br/>needs payments:manage"| ACC["getAccountStatus"]
        RO -->|"POST /payments/stripe/connect<br/>needs payments:manage"| CON["connectAccount — Express onboarding link"]
    end

    subgraph HOOK["Platform webhook — @Platform @Public"]
        WH["POST /payments/stripe/webhook<br/>Stripe-Signature header; throttle 1000 / 60s"] --> HC["PaymentsController.handleWebhook"]
        RB{"rawBody present?<br/>(main.ts rawBody: true)"}
        RB -->|"no"| RBE["400 Raw body is required"]
        RB -->|"yes"| V{"constructEvent signature verification"}
        V -->|"invalid"| VE["400 Invalid webhook signature"]
        V -->|"valid"| EV["event switch"]
    end

    subgraph PLATFORM["Platform route"]
        PC["POST /platform/tenants/:id/subscription/cancel<br/>@Platform; SUPER_ADMIN role required"]
    end

    subgraph APP["Application"]
        CP --> SPS["StripePaymentService<br/>compatibility facade"]
        CS --> SPS
        CX --> SPS
        ACC --> SPS
        CON --> SPS
        HC --> SPS
        PC --> SPS
        SPS --> OPS["OrderPaymentService<br/>intent, refund, reconciliation"]
        SPS --> SUBS["SubscriptionPaymentService<br/>intent, refund, reconciliation"]
        SPS --> WHS["StripeWebhookService<br/>signature verification + dispatch"]
        SPS --> SCS["StripeConnectService<br/>accounts, balances, payouts, onboarding"]
        WHS --> RB
        EV --> OPS
        EV --> SUBS
        OPS --> TM["TenantManagerService.getRepository<br/>Payment, Order (tenant schema)"]
        SCS --> TEN["Tenant (public schema)<br/>stripeAccountId + save on connect"]
        SUBS --> SS["SubscriptionService<br/>assignPlan / downgradeToFree"]
        SS --> TEN
        OPS --> CLIENT["StripeClientService<br/>one shared Stripe SDK client"]
        SUBS --> CLIENT
        WHS --> CLIENT
        SCS --> CLIENT
    end

    subgraph DATA["Data / external"]
        TM --> TDB[("PostgreSQL tenant schema<br/>payments, orders")]
        SUBS --> PDB[("PostgreSQL public schema<br/>subscription_plans, subscriptions,<br/>subscription_payments")]
        SS --> PDB
        CLIENT --> STRIPE[("Stripe API<br/>PaymentIntent / Refund / Account / Payout")]
    end
```

---

```mermaid
flowchart TD
    CP["createOrderPaymentIntent({ orderId }, req.user)"] --> P0["resolve tenant repos (tenant context required)"]
    P0 --> P1{"tenant.paymentsPaused?"}
    P1 -->|"yes"| P1E["409 Payments are paused for this store"]
    P1 -->|"no"| P2{"tenant.stripeAccountId set?"}
    P2 -->|"no"| P2E["409 Store is not connected to Stripe"]
    P2 -->|"yes"| P3["start transaction<br/>pessimistic_write lock on Order"]
    P3 --> P4{"order exists?"}
    P4 -->|"no"| P4E["404 Order not found"]
    P4 -->|"yes"| PO{"order.userId equals req.user.id<br/>or orders:manage / STORE_OWNER / SUPER_ADMIN?"}
    PO -->|"no"| P4E
    PO -->|"yes"| P5{"created more than 24h ago?"}
    P5 -->|"yes"| P5E["400 Payment window has expired"]
    P5 -->|"no"| P6{"order already PAID?"}
    P6 -->|"yes"| P6E["409 Order has already been paid"]
    P6 -->|"no"| P7{"latest Stripe payment exists?"}
    P7 -->|"requires_* / processing"| P7A["reuse existing clientSecret"]
    P7 -->|"succeeded / canceled"| P7E["409 conflict"]
    P7 -->|"none / other"| P8["amount = toMinorUnit(order.total)"]
    P8 --> P8V{"minor amount positive?"}
    P8V -->|"no"| P8E["400 Invalid order amount"]
    P8V -->|"yes"| P8A["applicationFee = round(amount × bps / 10000)"]
    P8A --> P9["stripe.paymentIntents.create inside transaction<br/>idempotencyKey tenant:{tenantId}:order:{orderId}:payment:v1<br/>destination charge + metadata.data"]
    P9 --> P10{"StripeInvalidRequestError?"} -->|"yes"| P10E["400 Store cannot accept payments right now"]
    P10 -->|"no"| P11["transaction manager inserts Payment PENDING<br/>and updates Order.paymentStatus PENDING"]
    P11 --> P12["return { clientSecret }"]
```

---

```mermaid
flowchart TD
    CS["createSubscriptionPaymentIntent({ planId, billingInterval? })"] --> S0{"tenant context?"}
    S0 -->|"no"| S0E["403 Tenant context is required"]
    S0 -->|"yes"| S1{"plan exists?"}
    S1 -->|"no"| S1E["404 Plan not found"]
    S1 -->|"yes"| S2{"plan.active?"}
    S2 -->|"no"| S2E["400 PLAN_INACTIVE"]
    S2 -->|"yes"| S3{"plan.isPublic?"}
    S3 -->|"no"| S3E["400 PLAN_NOT_PUBLIC"]
    S3 -->|"yes"| S4{"selected interval price positive?"}
    S4 -->|"no"| S4E["400 PLAN_NOT_PURCHASABLE"]
    S4 -->|"yes"| S4M["minorAmount = toMinorUnit(amount)"]
    S4M --> S4V{"minor amount positive?"}
    S4V -->|"no"| S4VE["400 Invalid subscription amount"]
    S4V -->|"yes"| S5{"tenant Subscription row?"}
    S5 -->|"no"| S5E["404 SUBSCRIPTION_NOT_FOUND"]
    S5 -->|"yes"| STX["begin public-schema transaction"]
    STX --> SL["pessimistic_write lock Subscription by tenantId<br/>and re-check row"]
    SL -->|"missing"| S5E
    SL -->|"found"| SA["load latest Stripe SubscriptionPayment<br/>by subscriptionId + provider only; createdAt DESC"]
    SA -->|"paymentRef present"| SR["retrieve existing PaymentIntent inside transaction"]
    SA -->|"none / no paymentRef"| SC
    SR -->|"requires_payment_method / requires_confirmation /<br/>requires_action / processing"| SREUSE["reuse existing clientSecret;<br/>no new ledger row"]
    SR -->|"succeeded"| SDONE["409 Subscription payment already completed"]
    SR -->|"canceled"| SCANCEL["409 New payment attempt required"]
    SR -->|"other"| SC["create platform PaymentIntent inside transaction<br/>no transfer_data / application_fee_amount<br/>metadata.data = subscription JSON<br/>idempotencyKey tenant:{tenantId}:subscription:{subscriptionId}:plan:{planId}:{interval}:payment:v1"]
    SC --> SE{"StripeInvalidRequestError?"}
    SE -->|"yes"| SEE["400 Subscription payment could not be started"]
    SE -->|"no"| SS["transaction manager saves SubscriptionPayment PENDING<br/>(paymentRef = intent id; amount = major units)"]
    SS --> SRET["return { clientSecret }"]

    SRET -.->|"payment_intent.succeeded webhook<br/>(metadata.data.kind = subscription)"| SWH["assignPlan first;<br/>then update ledger PAID"]
```

---

```mermaid
flowchart TD
    EV["webhook event"] --> SW{"event.type"}

    SW -->|"payment_intent.succeeded / canceled / payment_failed"| PI["parse metadata.data<br/>from event.data.object"]
    SW -->|"charge.refunded, refund.created/updated/failed, charge.refund.updated"| RC["resolveRefundContext:<br/>intent id + refund reference<br/>(pending/requires_action → return)"]
    SW -->|"other"| IGN["unhandled — log and return"]

    RC --> R1["stripe.paymentIntents.retrieve(id,<br/>expand latest_charge)"]
    R1 --> PI2{"metadata.data present?"}
    PI2 -->|"no"| IGN
    PI2 -->|"yes"| PI

    PI --> KND{"isSubscriptionPaymentMetaData<br/>(kind === 'subscription')?"}
    KND -->|"no (order)"| HO["handleOrderPaymentEvents"]
    KND -->|"yes (subscription)"| HS["handleSubscriptionEvents"]

    HO --> HO1["succeeded → successOrderPayment"]
    HO --> HO2["canceled → cancelOrderPayment"]
    HO --> HO3["payment_failed → failedOrderPayment"]
    HO --> HO4["refund → latestCharge →<br/>refundedOrderPayment"]

    HS --> HS1["succeeded → successSubscriptionPayment:<br/>if already PAID, return;<br/>otherwise assignPlan first, then ledger PAID"]
    HS --> HS2["canceled → ledger CANCELED"]
    HS --> HS3["payment_failed → ledger FAILED + failureReason"]
    HS --> HS4["refund → latestCharge →<br/>refundedSubscriptionPayment<br/>(full refund → downgradeToFree)"]

    HO1 --> M1["resolve tenant schema from metadata.tenant<br/>load Payment by paymentRef + Order by id & userId<br/>update both: PAID + paidAt"]
    HO2 --> M2["update both: Payment CANCELED,<br/>Order.paymentStatus UNPAID"]
    HO3 --> M3["update both: FAILED"]

    HS1 --> SMS1["public subscription_payments:<br/>status PAID + paidAt"]
    HS2 --> SMS2["status CANCELED"]
    HS3 --> SMS3["status FAILED + failureReason"]
    HS4 --> M5

    HO4 --> M5["use intent.latest_charge;<br/>if it is an id, retrieve the Charge;<br/>read cumulative amount_refunded"]

    M5 --> M6["refundedAmount = toMajorUnit(amount_refunded)"]
    M6 --> M7{"refundedAmount <= 0"} -->|"yes"| M7A["status = PAID"]
    M7 -->|"no"| M8{"refundedAmount >= payment.amount"}
    M8 -->|"yes"| M8A["status = REFUNDED"]
    M8 -->|"no"| M8B["status = PARTIALLY_REFUNDED"]
    M7A --> M9
    M8A --> M9
    M8B --> M9["order: update Payment + Order mirror in parallel, not one transaction;<br/>subscription: update the ledger row<br/>(refundReference, refundedAmount, refundedAt)"]

    subgraph ORDERFLOW["Orders integration — StripePaymentService facade → OrderPaymentService.refundOrder"]
        RO1["find latest PAID Payment for the order"] --> RO2{"found?"}
        RO2 -->|"no"| RO3["return null (nothing to refund)"]
        RO2 -->|"yes"| RO4["stripe.refunds.create<br/>reverse_transfer + refund_application_fee<br/>idempotencyKey refund-{payment.id}"]
        RO4 --> RO5["update Payment REFUNDED<br/>return { refundedAt }"]
    end
```

Notes:

- `POST /payments/stripe` has no `@Permissions` decorator, but still passes through the tenant, JWT, email-verification, subscription, and throttling guards. It passes `req.user` through the facade. `OrderPaymentService` permits the order owner or a user with `orders:manage`, `STORE_OWNER`, or `SUPER_ADMIN`; every other caller receives the same 404 as a missing order. Platform tokens still cannot access this tenant route. Stripe idempotency keys are scoped as `tenant:{tenantId}:order:{orderId}:payment:v1` to eliminate cross-tenant collisions on the platform account.
- `POST /payments/stripe/subscription` requires `subscriptions:manage` (seeded for STORE_OWNER; ADMIN has only `subscriptions:read` by default) and charges the **platform** Stripe account: no Connect account, `paymentsPaused` gate, `transfer_data`, or `application_fee_amount`. The tenant route has no `@Roles` restriction, so its effective authorization is permission-based. Inside a public-schema transaction it locks the tenant's `Subscription`, reuses the latest active Stripe intent, or creates a new intent with `tenant:{tenantId}:subscription:{subscriptionId}:plan:{planId}:{interval}:payment:v1` before saving a `PENDING` ledger row. The latest-attempt lookup is by subscription and provider, not by requested plan or interval.
- Neither payment ledger has a database uniqueness constraint on `paymentRef` or its logical attempt tuple. `SubscriptionPayment.idempotencyKey` is an unmapped, unwritten property. Duplicate prevention currently relies on the locked Order/Subscription row, latest-attempt lookup, and Stripe idempotency keys; only `Subscription.tenantId` is uniquely constrained.
- `webHook` is called through the compatibility facade, verifies the raw-body signature in `StripeWebhookService`, and classifies events on `metadata.data.kind` (`isSubscriptionPaymentMetaData`). Order metadata has no `kind`; subscription intents (`kind: 'subscription'`) route to `handleSubscriptionEvents`. Refund-family events carry no metadata, so the intent is fetched once with `latest_charge` and then routed. Order Payment/Order mirror writes run in parallel but not in one transaction. A **fully** refunded subscription payment falls back to the free plan; partial refunds and reversals keep the paid plan.
- `successSubscriptionPayment` returns immediately only when the ledger is already `PAID`. Otherwise it calls `SubscriptionService.assignPlan` before updating the ledger. Plan assignment, storage-capacity synchronization, and the ledger update do not share a transaction; a failure after assignment but before `PAID` can cause a retry to assign the plan again. A missing `SubscriptionPayment` row or `PLAN_INACTIVE` still returns non-2xx so Stripe retries.
- `POST /platform/tenants/:id/subscription/cancel` (`@Platform @Roles([SUPER_ADMIN])`) finds the latest `PAID` ledger row and refunds it only when `paymentRef` exists; no PAID row or a missing reference does not prevent the free-plan downgrade. `POST /payments/stripe/subscription/cancel` requires `subscriptions:manage` and instead returns `SUBSCRIPTION_NOT_REFUNDABLE` unless a previous `REFUNDED` row proves an idempotent repeat. It enforces `SUBSCRIPTION_REFUND_WINDOW_DAYS` (7) from `paidAt` (fallback `createdAt`); `GET /subscription` exposes an advisory `refundEligible`/`refundDeadline` snapshot, while the cancel route re-checks authoritatively.
- Both subscription cancellation flows execute Stripe refund → ledger update → downgrade without one database transaction. `refund-subscription-{paymentId}` deduplicates repeated route/service refund creation; refund webhooks do not use that key and only reconcile Stripe's cumulative refunded amount.
- `refundOrder` performs the Stripe refund and marks the Payment `REFUNDED` before `OrdersService.cancel` or `ManageOrderService.updateStatus` starts its Order/restock/coupon transaction. No transaction spans these stages; a later order transaction failure can leave the payment ledger refunded while the Order remains unchanged. PaymentIntent creation still calls Stripe while its pessimistic Order lock is open.
- `OrderPaymentService.cancelOrderPayment` / `failedOrderPayment` write `canceledAt` / `failedAt`; those columns are not declared on the `Payment` (or `Order`) entity today, so treat them as intended state fields rather than persisted ones.
