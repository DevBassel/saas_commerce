```mermaid
flowchart TD
    Client["Client (tenant admin / customer)"] --> GUARDS["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]

    subgraph API["API — CouponsController /api/v1/coupons"]
        GUARDS --> RO{"route"}
        RO -->|"POST /coupons/validate<br/>needs coupons:validate"| VA["validate — preview against the caller's cart,<br/>no usage consumed"]
        RO -->|"POST /coupons<br/>needs coupons:create"| CR["create — normalize code, cross-field rules,<br/>duplicate code 400"]
        RO -->|"GET /coupons<br/>needs coupons:read"| FA["findAll — optional isActive/code filter,<br/>newest first"]
        RO -->|"GET /coupons/:id<br/>needs coupons:read"| FO["findOne — 404 if missing"]
        RO -->|"PATCH /coupons/:id<br/>needs coupons:update"| UP["update — partial patch, re-check code unique,<br/>block code change when redeemed"]
        RO -->|"PATCH /coupons/:id/status<br/>needs coupons:update"| ST["setStatus — toggle isActive"]
        RO -->|"DELETE /coupons/:id<br/>needs coupons:delete"| RM["remove — 409 when usageCount > 0,<br/>deactivate instead"]
    end

    subgraph APP["Application — CouponsService"]
        SVC["All methods"] --> TRT{"tenant context<br/>(tenantStorage or arg)?"}
        TRT -->|"none"| TRTE["403 Tenant context is required"]
        TRT -->|"resolved"| TM["TenantManagerService.getRepository<br/>Coupon, CouponRedemption<br/>(tenant schema only)"]
        VA --> CART["CartService.getCart(userId)<br/>current subtotal"]
        CR --> RULES["assertRules / assertDateRange / assertCodeValid"]
        UP --> RULES
        VA --> RULES2["assertRedeemable: active, window,<br/>minOrderAmount, usageLimit, perUserLimit"]
        CART --> RULES2
        RULES2 --> CD["computeDiscount (pure)"]
    end

    subgraph DATA["Data"]
        TM --> TDB[("PostgreSQL tenant schema<br/>coupons, coupon_redemptions, orders")]
    end
```

---

```mermaid
flowchart TD
    CHK["OrdersService.checkout(userId, {addressId, couponCode})"] --> TX["orderRepo.manager.transaction<br/>wrapped by withUniqueRetry"]
    TX --> LOCKP["lock products (pessimistic_write)"]
    LOCKP --> SUB["subtotal = SUM(lineTotal)"]
    SUB --> HAS{"couponCode?"}
    HAS -->|"no"| ORDER["save Order: total = subtotal,<br/>discountAmount = 0"]
    HAS -->|"yes"| VAC["CouponsService.validateAndConsume(manager, {code,userId,subtotal})"]
    VAC --> LC["SELECT ... FROM coupons WHERE code = :code<br/>FOR UPDATE (pessimistic_write, ['coupon'])"]
    LC --> NF{"found?"} -->|"no"| NF400["400 Coupon not found"]
    NF -->|"yes"| CHK2{"active / window /<br/>subtotal >= minOrderAmount /<br/>usageCount < usageLimit /<br/>per-user count < perUserLimit?"}
    CHK2 -->|"no"| CHK400["400 specific reason"]
    CHK2 -->|"yes"| DISC["computeDiscount → discountAmount, snapshot"]
    DISC --> ORDER2["save Order with subtotal, discountAmount,<br/>total = subtotal - discountAmount,<br/>coupon snapshots, couponId"]
    ORDER2 --> CONS["Consume: coupons.usageCount += 1<br/>insert coupon_redemptions(couponId, orderId, userId, discountAmount)"]
    CONS --> LINES["insert order_items, decrement stock, clear cart"]
    ORDER --> LINES
    LINES --> COMMIT["commit (any error rolls back everything)"]

    CANCEL["OrdersService.cancel / ManageOrderService.updateStatus → CANCELLED/RETURNED"] --> RTX["same DB transaction as restock"]
    RTX --> RU{"order.couponId?"} -->|"no"| RNO["no-op"]
    RU -->|"yes"| RDEL["delete coupon_redemptions(orderId, couponId)"]
    RDEL --> RAFF{"row deleted?"} -->|"no"| RIDEM["idempotent no-op"]
    RAFF -->|"yes"| RDEC["UPDATE coupons SET usageCount = usageCount - 1<br/>WHERE id = :id AND usageCount > 0"]
```

Rules (`coupons.service.ts`, `coupon-discount.ts`):
- Code is stored normalized (`trim().toUpperCase()`), unique per tenant schema, regex `^[A-Z0-9][A-Z0-9_-]*$`, max 64.
- `PERCENTAGE`: `0 < value <= 100`, optional `maxDiscountAmount` cap; `FIXED_AMOUNT`: `value > 0`, `maxDiscountAmount` rejected.
- Discount applies to `subtotal` only, rounded to cents and clamped to `[0, subtotal]`; `total` is never negative.
- MVP allows one coupon per order; consumption is atomic with checkout (`usageCount` counter + `CouponRedemption` row), so a failed checkout restores both automatically.
- `POST /coupons/validate` previews against the caller's cart and never consumes usage.
