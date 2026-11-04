```mermaid
flowchart TD
    subgraph TENANT["Tenant routes — PaymentsController /api/v1/payments"]
        C["Client (tenant user)"] --> G["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]
        G --> RO{"route"}
        RO -->|"POST /payments/stripe<br/>(authenticated; no @Permissions decorator)"| CP["createPayment — Stripe PaymentIntent,<br/>returns clientSecret"]
        RO -->|"POST /payments/stripe/subscription<br/>needs subscriptions:manage"| CS["createSubscriptionPaymentIntent —<br/>platform PaymentIntent for a plan"]
        RO -->|"POST /payments/stripe/subscription/cancel<br/>needs subscriptions:manage"| CX["cancelOwnSubscription —<br/>refund latest PAID purchase (7-day window)<br/>+ downgrade to free"]
        RO -->|"GET /payments/stripe/account<br/>needs payments:manage"| ACC["getAccountStatus"]
        RO -->|"POST /payments/stripe/connect<br/>needs payments:manage"| CON["connectAccount — Express onboarding link"]
    end

    subgraph HOOK["Platform webhook — @Platform @Public"]
        WH["POST /payments/stripe/webhook<br/>Stripe-Signature header"] --> V{"verify raw body signature<br/>(main.ts rawBody: true)"}
        V -->|"invalid"| VE["400 Invalid webhook signature"]
        V -->|"valid"| EV["event switch"]
    end

    subgraph APP["Application"]
        CP --> SPS["StripePaymentService<br/>compatibility facade"]
        CS --> SPS
        CX --> SPS
        ACC --> SPS
        CON --> SPS
        EV --> SPS
        SPS --> OPS["OrderPaymentService<br/>intent, refund, reconciliation"]
        SPS --> SUBS["SubscriptionPaymentService<br/>intent, refund, reconciliation"]
        SPS --> WHS["StripeWebhookService<br/>signature verification + dispatch"]
        SPS --> SCS["StripeConnectService<br/>accounts, balances, payouts, onboarding"]
        WHS --> OPS
        WHS --> SUBS
        OPS --> TM["TenantManagerService.getRepository<br/>Payment, Order (tenant schema)"]
        SCS --> TEN["Tenant (public schema)<br/>stripeAccountId + save on connect"]
        OPS --> CLIENT["StripeClientService<br/>one shared Stripe SDK client"]
        SUBS --> CLIENT
        WHS --> CLIENT
        SCS --> CLIENT
    end

    subgraph DATA["Data / external"]
        TM --> TDB[("PostgreSQL tenant schema<br/>payments, orders")]
        SUBS --> PDB[("PostgreSQL public schema<br/>subscription_payments")]
        CLIENT --> STRIPE[("Stripe API<br/>PaymentIntent / Refund / Account / Payout")]
    end
```

---

```mermaid
flowchart TD
    CP["createOrderPaymentIntent({ orderId })"] --> P0["resolve tenant repos (tenant context required)"]
    P0 --> P1{"tenant.paymentsPaused?"}
    P1 -->|"yes"| P1E["409 Payments are paused for this store"]
    P1 -->|"no"| P2{"tenant.stripeAccountId set?"}
    P2 -->|"no"| P2E["409 Store is not connected to Stripe"]
    P2 -->|"yes"| P3["start transaction<br/>pessimistic_write lock on Order"]
    P3 --> P4{"order exists?"}
    P4 -->|"no"| P4E["404 Order not found"]
    P4 -->|"yes"| P5{"created more than 24h ago?"}
    P5 -->|"yes"| P5E["400 Payment window has expired"]
    P5 -->|"no"| P6{"order already PAID?"}
    P6 -->|"yes"| P6E["409 Order has already been paid"]
    P6 -->|"no"| P7{"latest Stripe payment exists?"}
    P7 -->|"active intent"| P7A["reuse existing clientSecret"]
    P7 -->|"succeeded / canceled"| P7E["409 conflict"]
    P7 -->|"none / other"| P8["amount = round(order.total 100)<br/>applicationFee = round(amount bps / 10000)"]
    P8 --> P9["stripe.paymentIntents.create<br/>idempotencyKey order:{orderId}:payment:v1<br/>destination charge + metadata.data"]
    P9 --> P10{"StripeInvalidRequestError?"} -->|"yes"| P10E["400 Store cannot accept payments right now"]
    P10 -->|"no"| P11["transaction manager inserts Payment PENDING<br/>and updates Order.paymentStatus PENDING"]
    P11 --> P12["return { clientSecret }"]
```

---

```mermaid
flowchart TD
    CS["createSubscriptionPaymentIntent({ planId, billingInterval? })"]
        S0{"tenant context?"} -->|"no"| S0E["403 Tenant context is required"]
        S0 -->|"yes"| S1{"plan exists?"}
        S1 -->|"no"| S1E["404 Plan not found"]
        S1 -->|"yes"| S2{"plan.active?"}
        S2 -->|"no"| S2E["400 PLAN_INACTIVE"]
        S2 -->|"yes"| S3{"plan.isPublic?"}
        S3 -->|"no"| S3E["400 PLAN_NOT_PUBLIC"]
        S3 -->|"yes"| S4{"interval price > 0?<br/>(yearlyPrice or monthlyPrice)"}
        S4 -->|"no"| S4E["400 PLAN_NOT_PURCHASABLE"]
        S4 -->|"yes"| S5{"tenant Subscription row?"}
        S5 -->|"no"| S5E["404 SUBSCRIPTION_NOT_FOUND"]
        S5 -->|"yes"| S6["stripe.paymentIntents.create<br/>amount = toMinorUnit(amount), currency = plan.currency<br/>payment_method_types [card]<br/>NO transfer_data / application_fee_amount<br/>metadata.data = JSON {kind: subscription, subscriptionId, tenantId, planId, billingInterval, tenant}"]
        S6 --> S7{"StripeInvalidRequestError?"} -->|"yes"| S7E["400 Subscription payment could not be started"]
        S7 -->|"no"| S8["save SubscriptionPayment PENDING<br/>(paymentRef = PI id, amount = major units)"]
        S8 --> S9["return { clientSecret }"]

    S9 -.->|"payment_intent.succeeded webhook<br/>(metadata.data.kind = subscription)"| S10["handleSubscriptionEvents:<br/>ledger PAID + SubscriptionService.assignPlan"]
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

    HS --> HS1["succeeded → successSubscriptionPayment:<br/>ledger PAID + SubscriptionService.assignPlan<br/>(ACTIVE/TRIALING, period, storage sync);<br/>idempotent when already PAID"]
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

    HO4 --> M5["retrieve PaymentIntent with latest_charge,<br/>read cumulative amount_refunded"]

    M5 --> M6["refundedAmount = toMajorUnit(amount_refunded)"]
    M6 --> M7{"refundedAmount <= 0"} -->|"yes"| M7A["status = PAID"]
    M7 -->|"no"| M8{"refundedAmount >= payment.amount"}
    M8 -->|"yes"| M8A["status = REFUNDED"]
    M8 -->|"no"| M8B["status = PARTIALLY_REFUNDED"]
    M7A --> M9
    M8A --> M9
    M8B --> M9["order: update Payment + Order mirror in parallel;<br/>subscription: update the ledger row<br/>(refundReference, refundedAmount, refundedAt)"]

    subgraph ORDERFLOW["Orders integration — StripePaymentService facade → OrderPaymentService.refundOrder"]
        RO1["find latest PAID Payment for the order"] --> RO2{"found?"}
        RO2 -->|"no"| RO3["return null (nothing to refund)"]
        RO2 -->|"yes"| RO4["stripe.refunds.create<br/>reverse_transfer + refund_application_fee<br/>idempotencyKey refund-{payment.id}"]
        RO4 --> RO5["update Payment REFUNDED<br/>return { refundedAt }"]
    end
```

Notes:

- `POST /payments/stripe` has no `@Permissions` decorator, so any authenticated tenant user passes the guard; the order lookup is by `orderId` alone, not by `order.userId`.
- `POST /payments/stripe/subscription` requires `subscriptions:manage` (STORE_OWNER only; ADMIN has `subscriptions:read` only) and charges the **platform** Stripe account: no Connect account, no `paymentsPaused` gate, no `transfer_data`/`application_fee_amount`. It persists a `PENDING` `SubscriptionPayment`; the plan is assigned only when the `payment_intent.succeeded` webhook reconciles the intent (`kind === 'subscription'` → `handleSubscriptionEvents` → `successSubscriptionPayment` → `assignPlan` + ledger `PAID`).
- `webHook` classifies events on `metadata.data.kind` (`isSubscriptionPaymentMetaData`): order metadata has no `kind`, so the order path is byte-identical; subscription intents (`kind: 'subscription'`) route to `handleSubscriptionEvents`. Refund-family events carry no metadata, so the intent is fetched once (with `latest_charge`) and then routed. A **fully** refunded subscription payment (`status === REFUNDED`) falls back to the free plan via `SubscriptionService.downgradeToFree` (period reset + storage capacity re-synced); partial refunds and reversals keep the paid plan, and the fallback is idempotent across webhook retries.
- `successSubscriptionPayment` early-returns when the ledger row is already `PAID`, so Stripe webhook retries/redeliveries do not reset the subscription period. A missing `SubscriptionPayment` row (or a `PLAN_INACTIVE` on assign) still throws → non-2xx → Stripe retries.
- `POST /platform/tenants/:id/subscription/cancel` (`@Platform @Roles([SUPER_ADMIN])`, in `PaymentsModule`) = `StripePaymentService.cancelSubscriptionWithRefund`: it refunds the latest `PAID` `SubscriptionPayment` on the **platform** account (no `reverse_transfer`/`refund_application_fee`; idempotency key `refund-subscription-{paymentId}`), marks the ledger `REFUNDED`, then calls `downgradeToFree`. Idempotent — a repeat finds no `PAID` row and only re-runs the (no-op) free fallback. This mirrors, and does not conflict with, the refund **webhook** reconciliation above.
- `POST /payments/stripe/subscription/cancel` (`subscriptions:manage`, tenant-scoped, in `PaymentsModule`) = `StripePaymentService.cancelOwnSubscription`: the self-serve counterpart but bounded by `SUBSCRIPTION_REFUND_WINDOW_DAYS` (7) from the latest `PAID` row's `paidAt` (fallback `createdAt`). Only `PAID` rows are considered (an in-flight `PENDING` upgrade never blocks refunding the earlier paid purchase); it reuses the same refund helper so the idempotency key dedupes with a refund webhook. Errors: `404 SUBSCRIPTION_NOT_FOUND`, `409 SUBSCRIPTION_NOT_REFUNDABLE` (no paid purchase), `409 REFUND_WINDOW_EXPIRED`; a repeat after `REFUNDED` is a `200` no-op. `GET /subscription` reports `refundEligible`/`refundDeadline` from the same window (read-time, advisory — this route re-checks).
- `refundOrder` is called by `OrdersService.cancel` and `ManageOrderService.updateStatus` **before** their DB transactions. `createOrderPaymentIntent` retains its current reliability behavior and calls Stripe while its pessimistic order-lock transaction is open.
- `OrderPaymentService.cancelOrderPayment` / `failedOrderPayment` write `canceledAt` / `failedAt`; those columns are not declared on the `Payment` (or `Order`) entity today, so treat them as intended state fields rather than persisted ones.
