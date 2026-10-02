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
    CA["cancel(id, requester)"]
        A0["load order + items"] --> A1{"exists and<br/>(owner or manage)?"}
        A1 -->|"no"| A1E["404 Order not found"]
        A1 -->|"yes"| A2{"cancellable status?"}
        A2 -->|"manage: PENDING/CONFIRMED/PROCESSING/SHIPPED"| A3
        A2 -->|"owner: only PENDING/CONFIRMED"| A3
        A2 -->|"otherwise"| A2E["400 Order cannot be cancelled from status"]
        A3["refundOrderIfPaid BEFORE the transaction:<br/>paymentStatus PAID → Stripe refund<br/>(paid but no refundable payment → 400)"] --> A4["transaction: status = CANCELLED<br/>(+ paymentStatus REFUNDED / refundedAt when refunded)"]
        A4 --> A5["increment product.stock per line<br/>(skip productId = null)"]

    RR["requestReturn(id, requester)"]
        R0["tenant transaction: load order + items"] --> R1{"exists and<br/>(owner or manage)?"}
        R1 -->|"no"| R1E["404 Order not found"]
        R1 -->|"yes"| R2{"status = DELIVERED?"}
        R2 -->|"no"| R2E["400 Return can only be requested<br/>for a delivered order"]
        R2 -->|"yes"| R3["status = RETURN_REQUESTED<br/>(no restock, no refund yet)"]

    US["updateStatus(id, dto)"]
        U0["load order + items"] --> U1{"next in ALLOWED_TRANSITIONS<br/>from current status?"}
        U1 -->|"no"| U1E["400 Cannot change order status from X to Y"]
        U1 -->|"yes"| U2["next = CANCELLED or RETURNED?"]
        U2 -->|"yes"| U3["refundOrderIfPaid before the transaction"]
        U2 -->|"no"| U4["transaction: set status"]
        U3 --> U5["transaction: set status<br/>(+ payment mirror when refunded)<br/>+ restock when restockable"]
        U4 --> U4B["transaction: set status only (no restock)"]
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

Entering `CANCELLED` or `RETURNED` restocks every line and refunds the order when `paymentStatus` is `PAID`. Refunds always run before the status transaction so a paid order is never cancelled without the customer's money coming back.
