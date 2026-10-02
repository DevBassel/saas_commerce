```mermaid
flowchart TD
    subgraph TENANT["Tenant routes — PaymentsController /api/v1/payments"]
        C["Client (tenant user)"] --> G["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]
        G --> RO{"route"}
        RO -->|"POST /payments/stripe<br/>(authenticated; no @Permissions decorator)"| CP["createPayment — Stripe PaymentIntent,<br/>returns clientSecret"]
        RO -->|"GET /payments/stripe/account<br/>needs payments:manage"| ACC["getAccountStatus"]
        RO -->|"POST /payments/stripe/connect<br/>needs payments:manage"| CON["connectAccount — Express onboarding link"]
    end

    subgraph HOOK["Platform webhook — @Platform @Public"]
        WH["POST /payments/stripe/webhook<br/>Stripe-Signature header"] --> V{"verify raw body signature<br/>(main.ts rawBody: true)"}
        V -->|"invalid"| VE["400 Invalid webhook signature"]
        V -->|"valid"| EV["event switch"]
    end

    subgraph APP["Application"]
        CP --> SPS["StripePaymentService<br/>(only code importing the stripe SDK)"]
        ACC --> SPS
        CON --> SPS
        EV --> SPS
        SPS --> PS["PaymentService<br/>webhook mirror updates"]
        SPS --> TM["TenantManagerService.getRepository<br/>Payment, Order (tenant schema)"]
        PS --> TM
        SPS --> TEN["Tenant (public schema)<br/>stripeAccountId + save on connect"]
    end

    subgraph DATA["Data / external"]
        TM --> TDB[("PostgreSQL tenant schema<br/>payments, orders")]
        SPS --> STRIPE[("Stripe API<br/>PaymentIntent / Refund / Account / Payout")]
    end
```

---

```mermaid
flowchart TD
    CP["createPayment({ orderId })"]
        P0["resolve tenant repos (tenant context required)"] --> P1{"order exists?"}
        P1 -->|"no"| P1E["404 Order not found"]
        P1 -->|"yes"| P2{"created more than 24h ago?"}
        P2 -->|"yes"| P2E["400 Payment window has expired"]
        P2 -->|"no"| P3{"tenant.paymentsPaused?"}
        P3 -->|"yes"| P3E["409 Payments are paused for this store"]
        P3 -->|"no"| P4{"tenant.stripeAccountId set?"}
        P4 -->|"no"| P4E["409 Store is not connected to Stripe"]
        P4 -->|"yes"| P5["amount = round(order.total 100)<br/>applicationFee = round(amount bps / 10000)"]
        P5 --> P6["stripe.paymentIntents.create<br/>currency = tenant.currency, payment_method_types [card]<br/>transfer_data.destination = stripeAccountId<br/>application_fee_amount when > 0<br/>metadata.data = JSON {orderId, userId, schemaName}"]
        P6 --> P7{"StripeInvalidRequestError?"} -->|"yes"| P7E["400 Store cannot accept payments right now"]
        P7 -->|"no"| P8["save Payment PENDING (paymentRef = PI id)<br/>+ Order.paymentStatus = PENDING (parallel)"]
        P8 --> P9["return { clientSecret }"]
```

---

```mermaid
flowchart TD
    EV["webhook event"] --> SW{"event.type"}

    SW -->|"payment_intent.created"| NOOP["no-op"]
    SW -->|"payment_intent.succeeded"| SUC["PaymentService.successPayment"]
    SW -->|"payment_intent.canceled"| CXL["PaymentService.canceledPayment"]
    SW -->|"payment_intent.payment_failed"| FAI["PaymentService.failedPayment"]
    SW -->|"charge.refunded, refund.created/updated/failed, charge.refund.updated"| REF["StripePaymentService.syncRefundState"]
    SW -->|"other"| IGN["unhandled — log and return"]

    SUC --> M1["resolve tenant from metadata.tenant schema<br/>load Payment by paymentRef + Order by id & userId<br/>update both: PAID + paidAt"]
    CXL --> M2["update both: Payment CANCELED,<br/>Order.paymentStatus UNPAID"]
    FAI --> M3["update both: FAILED"]
    REF --> M4{"refund terminal and has metadata?"}
    M4 -->|"no"| IGN
    M4 -->|"yes"| M5["retrieve PaymentIntent with latest_charge,<br/>read cumulative amount_refunded"]

    M5 --> M6["PaymentService.refundedPayment:<br/>refundedAmount = amount_refunded / 100"]
    M6 --> M7{"refundedAmount <= 0"} -->|"yes"| M7A["status = PAID"]
    M7 -->|"no"| M8{"refundedAmount >= payment.amount"}
    M8 -->|"yes"| M8A["status = REFUNDED"]
    M8 -->|"no"| M8B["status = PARTIALLY_REFUNDED"]
    M7A --> M9
    M8A --> M9
    M8B --> M9["update Payment + Order mirror in parallel<br/>(refundReference, refundedAmount, refundedAt)"]

    subgraph ORDERFLOW["Orders integration — StripePaymentService.refundOrder(order, tenant)"]
        RO1["find latest PAID Payment for the order"] --> RO2{"found?"}
        RO2 -->|"no"| RO3["return null (nothing to refund)"]
        RO2 -->|"yes"| RO4["stripe.refunds.create<br/>reverse_transfer + refund_application_fee<br/>idempotencyKey refund-{payment.id}"]
        RO4 --> RO5["update Payment REFUNDED<br/>return { refundedAt }"]
    end
```

Notes:

- `POST /payments/stripe` has no `@Permissions` decorator, so any authenticated tenant user passes the guard; the order lookup is by `orderId` alone, not by `order.userId`.
- `refundOrder` is called by `OrdersService.cancel` and `ManageOrderService.updateStatus` **before** the DB transaction, so Stripe is never invoked inside a transaction.
- `PaymentService.canceledPayment` / `failedPayment` write `canceledAt` / `failedAt`; those columns are not declared on the `Payment` (or `Order`) entity today, so treat them as intended state fields rather than persisted ones.
