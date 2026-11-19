```mermaid
flowchart TD
    Client["Client (tenant user)"] --> GUARDS["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]

    subgraph API["API — OrdersController /api/v1/orders"]
        GUARDS --> RO{"route"}
        RO -->|"POST /orders { addressId? }<br/>needs orders:create"| CO["checkout — cart → order, atomic,<br/>requires a delivery address"]
        RO -->|"GET /orders?status=&userId=<br/>needs orders:read"| FA["findAll — manage: all + filters;<br/>otherwise own orders only"]
        RO -->|"GET /orders/:id<br/>needs orders:read"| FO["findOne — 404 for non-owner"]
        RO -->|"PATCH /orders/:id/cancel<br/>needs orders:cancel"| CA["cancel — refunds if paid, restocks lines"]
        RO -->|"PATCH /orders/:id/return<br/>needs orders:return"| RR["requestReturn — DELIVERED → RETURN_REQUESTED"]
        RO -->|"PATCH /orders/:id/status<br/>needs orders:manage"| US["updateStatus — transition map,<br/>refund + restock on terminal states"]
    end

    subgraph APP["Application — OrdersService / ManageOrderService"]
        SVC["OrdersService: checkout / findAll / findOne / cancel / requestReturn<br/>ManageOrderService: updateStatus"] --> TRT{"tenant context<br/>(tenantStorage or arg)?"}
        TRT -->|"none"| TRTE["403 Tenant context required"]
        TRT -->|"resolved"| TM["TenantManagerService.getRepository<br/>Order, OrderItem, Product, Cart,<br/>CartItem, Address"]
        CO --> REF["StripePaymentService.refundOrder<br/>(cancel/return only, never inside a transaction)"]
        CA --> REF
        US --> REF
        CA --> R2S["R2Service.publicUrl (serialize)"]
        FO --> R2S
        FA --> R2S
        CO --> R2S
    end

    subgraph DATA["Data"]
        TM --> TDB[("PostgreSQL tenant schema<br/>orders, order_items, carts, cart_items,<br/>products, addresses")]
        REF --> STRIPE[("Stripe API — refunds")]
        R2S --> R2[("Cloudflare R2 bucket")]
    end
```

---

```mermaid
flowchart TD
    CO["checkout(userId, dto)"]
        C0["tenant transaction<br/>(retry once on orderNumber 23505)"] --> C1{"cart exists and has items?"}
        C1 -->|"no"| C1E["400 Cart is empty (rollback)"]
        C1 -->|"yes"| C2["SELECT products FOR UPDATE<br/>pessimistic_write + images"]
        C2 --> C3{"each line: product exists,<br/>active, stock >= qty?"}
        C3 -->|"no"| C3E["400 naming sku/product (rollback,<br/>stock and cart untouched)"]
        C3 -->|"yes"| C4["snapshot name/sku/unitPrice/lineTotal/<br/>imageObjectKey; subtotal = total = Σ lineTotal"]
        C4 --> C5{"delivery address"}
        C5 -->|"dto.addressId"| C5A{"address id + userId exists?"} -->|"no"| C5E["400 Delivery address not found"]
        C5 -->|"no addressId"| C5B{"default address exists?"} -->|"no"| C5F["400 Delivery address required"]
        C5A -->|"yes"| C6
        C5B -->|"yes"| C6["insert order (PENDING / UNPAID, orderNumber,<br/>addressId + address snapshot)<br/>then order_items"]
        C6 --> C7["decrement product.stock per line"]
        C7 --> C8["delete cart_items (keep cart row)"]
        C8 --> C9["commit → serialize (imageObjectKey → R2 url)"]
```

---

```mermaid
flowchart TD
    CA["cancel(id, requester)"] --> A0["begin tenant transaction<br/>load order FOR UPDATE<br/>load items separately"]
        A0 --> A1{"exists and<br/>(owner or manage)?"}
        A1 -->|"no"| A1E["404 Order not found"]
        A1 -->|"yes"| A2{"cancellable status?"}
        A2 -->|"manage: PENDING/CONFIRMED/PROCESSING/SHIPPED"| A3
        A2 -->|"owner: only PENDING/CONFIRMED"| A3
        A2 -->|"otherwise"| A2E["400 Order cannot be cancelled from status"]
        A3{"paid and refund not prepared?"}
        A3 -->|"yes"| AR["finish read-only transaction<br/>refundOrderIfPaid outside DB locks<br/>(paid but no refundable payment → 400)"]
        AR -->|"new transaction: re-lock and revalidate"| A0
        A3 -->|"no"| A4["conditional UPDATE by id + current status<br/>must affect one row; status = CANCELLED<br/>(+ payment mirror when refunded)"]
        A4 --> A5["restore stock + coupon usage<br/>only when exactly one order row transitioned"]
        A5 --> A6["commit status, stock and coupon restoration together"]

    RR["requestReturn(id, requester)"] --> R0["begin tenant transaction<br/>load order FOR UPDATE<br/>load items separately"]
        R0 --> R1{"exists and<br/>(owner or manage)?"}
        R1 -->|"no"| R1E["404 Order not found"]
        R1 -->|"yes"| R2{"status = DELIVERED?"}
        R2 -->|"no"| R2E["400 Return can only be requested<br/>for a delivered order"]
        R2 -->|"yes"| R3["conditional UPDATE by id + DELIVERED<br/>status = RETURN_REQUESTED<br/>commit; no restock or refund"]

    US["updateStatus(id, dto)"] --> U0["begin tenant transaction<br/>load order FOR UPDATE<br/>load items separately"]
        U0 --> U1{"next in ALLOWED_TRANSITIONS<br/>from locked current status?"}
        U1 -->|"no"| U1E["400 Cannot change order status from X to Y"]
        U1 -->|"yes"| U2{"terminal next, paid,<br/>and refund not prepared?"}
        U2 -->|"yes"| U3["finish read-only transaction<br/>refundOrderIfPaid outside DB locks"]
        U3 -->|"new transaction: re-lock and revalidate"| U0
        U2 -->|"no"| U4["conditional UPDATE by id + current status<br/>must affect one row<br/>set next status + any refund mirror"]
        U4 --> U5{"next = CANCELLED or RETURNED?"}
        U5 -->|"yes"| U6["restore stock + coupon usage"]
        U5 -->|"no terminal restoration"| U7["commit"]
        U6 --> U7
```

Order status transitions (`ManageOrderService.ALLOWED_TRANSITIONS`):

| From | Allowed next |
| --- | --- |
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED`, `CANCELLED` |
| `DELIVERED` | `RETURN_REQUESTED` |
| `RETURN_REQUESTED` | `RETURNED`, `DELIVERED` |
| `RETURNED`, `CANCELLED` | terminal |

Every status mutation loads the order with `pessimistic_write` inside its tenant transaction and validates the current locked status. Items use the query relation-loading strategy so the order lock does not target nullable joined rows. The conditional status update must affect exactly one row before stock or coupon usage is restored. The committed terminal status is the one-time restoration marker: concurrent or repeated requests cannot restore stock again, and failures roll back status, stock and coupon changes together.

For paid cancellation or return approval, a first locked, read-only transaction prepares the refund. Stripe runs outside DB transactions; the final transaction re-locks the order, revalidates eligibility, and commits the status, refund mirror, stock and coupon restoration together. An external refund cannot be rolled back if the status changes before that final recheck. Unpaid and non-refund transitions complete in one transaction.
