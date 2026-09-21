# Customer Cart — Implementation Plan

Add a tenant-scoped, owner-bound shopping cart for authenticated customers.
No checkout/orders, no payments, no stock reservation in this plan.

## Confirmed decisions

- **Identity**: authenticated tenant users only. Cart owner = `request.user.id`. No guest carts.
- **Scope**: cart management only — read, add, update quantity, remove, clear. Totals computed live from
  current `Product.price`/`Product.stock`. No orders, no stock decrement, no price snapshot.
- **Authorization**: new granular permissions `cart:read`, `cart:create`, `cart:update`, `cart:delete`.
  Every endpoint is additionally owner-scoped (data access is filtered by the caller's user id, so a
  user can only ever read/modify their own cart).
- **Cardinality**: exactly one persistent cart per user. Adding an existing product increments quantity
  (merge). Cart persists until items are removed or the cart is cleared.
- **Stock/inactive**: writes are validated (`1 <= quantity <= product.stock` and `product.isActive`).
  On read, items are never auto-removed; items whose product is inactive or whose quantity now exceeds
  stock are returned flagged (`isAvailable=false`, `availableStock`).
- **Money**: server computes `lineTotal` per item and `subtotal`/`totalItems`/`totalQuantity` on the cart.
  No currency field (matches `Product`, which has none).
- **Item payload**: each item is enriched with its live product summary — `productId`, `name`, `sku`,
  `unitPrice`, `quantity`, `lineTotal`, `isActive`, `isAvailable`, `availableStock`, and `imageUrl`
  (primary image = lowest `position`, resolved with `R2Service.publicUrl`). `R2Module` is `@Global()`
  (`src/common/storage/r2.module.ts:5`), so no module wiring is needed for `R2Service`.
- **Bounds**: max quantity per line `99` and max `100` distinct items per cart, as code constants
  (not env). `product.stock` remains the hard cap whenever it is lower.
- **Routes**: nested by `productId` — `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:productId`,
  `DELETE /cart/items/:productId`, `DELETE /cart`. `POST` is intentionally **not** idempotent (it merges by
  incrementing); `PATCH` sets an absolute quantity. All routes return the full cart (except none — every
  mutation responds with `getCart`). Existing controllers use minimal Swagger decorators (only
  `@ApiBody`/`@ApiConsumes` for uploads), so none are required here.

## Existing conventions this must follow

- Tenant data is reached via `TenantManagerService.getRepository(Entity, tenant)` with the tenant from
  `tenantRefFromContext()` (`src/modules/products/products.service.ts:39`). Tenant entities must be
  registered in `src/modules/tenants/tenant-entities.ts`.
- Permissions are centrally seeded: `PermissionKey` union in `src/common/constants/PermissionKey.enum.ts`,
  `SEED_PERMISSIONS` + `SEED_ROLE_PERMISSIONS` in `src/modules/rbac/constants/seed-data.ts`. `seedRbac`
  (`src/modules/rbac/rbac.seed.ts`) runs at bootstrap and re-runs for all ACTIVE tenants via
  `TenantReseedService`, so new permissions are backfilled automatically. STORE_OWNER and SUPER_ADMIN
  receive every seeded permission automatically via `ALL_PERMISSION_KEYS`.
- Guards are global (order: TenantGuard → JwtGuard → PermissionGuard); cart routes are normal tenant
  routes (do **not** use `@Platform()`/`@Public()`). `JwtGuard` populates `request.user.id` and the live
  permission set; `@Permissions([...])` enforces one key per route.
- DTO validation via class-validator; global `ValidationPipe` rejects unknown body fields.
- Price is a `numeric(10,2)` with a transformer that yields `number` (`product.entity.ts:31`).

## Tasks

### 1. Cart permission keys

- [ ] Create `src/modules/cart/constants/cart-permissions.enum.ts`:
  `CartPermissionKey = { READ: 'cart:read', CREATE: 'cart:create', UPDATE: 'cart:update', DELETE: 'cart:delete' }`.
- [ ] Add `CartPermissionKey` to the `PermissionKey` union in `src/common/constants/PermissionKey.enum.ts`.
- [ ] In `src/modules/rbac/constants/seed-data.ts`: append the four `SEED_PERMISSIONS` entries and grant all
  four to `[RoleKey.CUSTOMER]` and to `[RoleKey.ADMIN]`. (STORE_OWNER/SUPER_ADMIN are automatic.)
- [ ] Update `src/modules/rbac/constants/seed-data.spec.ts`:
  - Replace `it('grants CUSTOMER nothing', ...)` with an assertion that CUSTOMER contains the four
    `CartPermissionKey` values.
  - Add an assertion that ADMIN contains the four cart permissions.
  - **Known inconsistency to fix while here**: the current spec expects `SEED_ROLE_PERMISSIONS[CUSTOMER]`
    to equal `[]`, but `seed-data.ts:170` currently grants `[ProductPermissionKey.READ]`. Make the spec
    match the final seed matrix; do not leave it contradictory.

### 2. Cart entities

- [ ] `src/modules/cart/entities/cart.entity.ts` — `@Entity('carts')`:
  `id` PK; `userId` int with `@Index({ unique: true })` and `@ManyToOne(() => User, { onDelete: 'CASCADE' })`
  + `@JoinColumn({ name: 'userId' })` (the tenant `User`, same schema); `items`
  `OneToMany(() => CartItem, item => item.cart)`; `createdAt`/`updatedAt`. One cart per user is enforced by
  the unique `userId` index. Do not rely on relation cascades — the service manages items explicitly.
- [ ] `src/modules/cart/entities/cart-item.entity.ts` — `@Entity('cart_items')`:
  `id` PK; `cartId` int + `@ManyToOne(() => Cart, cart => cart.items, { onDelete: 'CASCADE' })`
  + `@JoinColumn({ name: 'cartId' })`; `productId` int + `@ManyToOne(() => Product, { onDelete: 'CASCADE' })`
  + `@JoinColumn({ name: 'productId' })`; `quantity` int; `createdAt`/`updatedAt`. Add a composite unique
  index on `(cartId, productId)` so the same product cannot appear twice in a cart.
- [ ] Register `Cart` and `CartItem` in `TENANT_ENTITIES` (`src/modules/tenants/tenant-entities.ts`).
  Do **not** touch `PUBLIC_ENTITIES` in `core.module.ts`.

### 3. Constants and DTOs

- [ ] `src/modules/cart/constants/cart.constants.ts`:
  `MAX_CART_ITEM_QUANTITY = 99`, `MAX_CART_ITEMS = 100` (per user cart).
- [ ] `src/modules/cart/dto/add-cart-item.dto.ts`: `productId` `@IsInt() @Min(1)`; `quantity`
  `@IsOptional() @IsInt() @Min(1) @Max(MAX_CART_ITEM_QUANTITY)` (service defaults to `1`).
- [ ] `src/modules/cart/dto/update-cart-item.dto.ts`: `quantity` `@IsInt() @Min(1) @Max(MAX_CART_ITEM_QUANTITY)`
  (absolute set value, not a delta; quantity `0` is not a removal — use `DELETE`).

### 4. Cart service

- [ ] `src/modules/cart/cart.service.ts`, constructor-injecting `TenantManagerService` and `R2Service`
  (both available: `TenantModule` is imported, `R2Module` is `@Global`). Mirror the `resolveTenant`/`repos`
  helpers from `ProductsService` (`src/modules/products/products.service.ts:39`).
- [ ] Repos: `Cart`, `CartItem`, `Product` via `getRepository(..., tenant)`.
- [ ] `getCart(userId, tenant?)`:
  - `cartRepo.findOne({ where: { userId } })` with `relations: { items: true }`; if absent return the
    synthetic empty cart **without writing**.
  - Collect `productId`s, load products in one query (`In(ids)`, `relations: { images: true }`). FK
    `onDelete: 'CASCADE'` guarantees each item's product exists; still guard defensively and skip items
    whose product is missing rather than throwing.
  - Per item: `unitPrice = product.price`, `lineTotal = round2(price * quantity)`,
    `isActive = product.isActive`,
    `isAvailable = product.isActive && product.stock >= item.quantity`,
    `availableStock = product.stock`, `name`, `sku`,
    `imageUrl = primaryImage ? r2.publicUrl(primaryImage.objectKey) : null` where primary image is the
    image with the lowest `position` (ties: lowest `id`).
  - Sort items by `id` ASC for stable output.
  - `subtotal = round2(sum(lineTotal))`, `totalItems = items.length`,
    `totalQuantity = sum(quantity)`. Add a `round2` helper (`Math.round(v * 100) / 100`) to avoid float drift.
- [ ] `addItem(userId, dto, tenant?)` (perm `cart:create`), all inside
  `repo.manager.transaction(...)` on the tenant DataSource:
  - Validate product: exists (400 `Product not found`), `isActive === true` (400
    `Product is not available`), `product.stock > 0` (400 `Product is out of stock`).
  - Find-or-create the cart for `userId`. On insert, catch the `userId` unique-violation and re-fetch
    (guards concurrent first-adds).
  - Target quantity: existing item → `existing.quantity + dto.quantity`; new item → `dto.quantity ?? 1`.
  - Reject when target > `min(product.stock, MAX_CART_ITEM_QUANTITY)` (400 `Insufficient stock` /
    `Quantity exceeds maximum`).
  - For a new product line, reject when the cart already holds `MAX_CART_ITEMS` distinct items (400).
  - Upsert; on `(cartId, productId)` unique-violation retry once (re-read then increment). New rows get
    `quantity`, existing rows are `update`d.
  - Return `getCart(userId)` after the transaction commits.
- [ ] `updateItem(userId, productId, dto, tenant?)` (perm `cart:update`):
  - 404 if the user has no cart or no item for `productId`.
  - Reject (400) when the product is missing/inactive, or when
    `dto.quantity > min(product.stock, MAX_CART_ITEM_QUANTITY)` — unless `dto.quantity <= item.quantity`
    (i.e. the user is reducing an already over-stock or now-inactive line; only increases are blocked).
  - Persist and return `getCart(userId)`.
- [ ] `removeItem(userId, productId, tenant?)` (perm `cart:delete`): 404 if the user has no cart or no such
  item; delete; return `getCart(userId)`.
- [ ] `clearCart(userId, tenant?)` (perm `cart:delete`): if no cart, return the empty cart; otherwise
  `itemRepo.delete({ cartId })` (keep the cart row so `userId` uniqueness is stable) and return the empty cart.
- [ ] Serialization types in `src/modules/cart/constants/cart.interface.ts`
  (`SerializedCart`, `SerializedCartItem`).

### 5. Controller + module

- [ ] `src/modules/cart/cart.controller.ts`, `@Controller('cart')`, using
  `@Req() request: RequestWithUser` for `request.user.id` (same pattern as `users.controller.ts:27`):
  - `GET /cart` — `@Permissions([CartPermissionKey.READ])`
  - `POST /cart/items` — `@Permissions([CartPermissionKey.CREATE])`, body `AddCartItemDto`
  - `PATCH /cart/items/:productId` — `@Permissions([CartPermissionKey.UPDATE])`,
    `@Param('productId', ParseIntPipe)`, body `UpdateCartItemDto`
  - `DELETE /cart/items/:productId` — `@Permissions([CartPermissionKey.DELETE])`, `ParseIntPipe`
  - `DELETE /cart` — `@Permissions([CartPermissionKey.DELETE])`
- [ ] `src/modules/cart/cart.module.ts`: imports `[TenantModule]`; declares controller + service;
  exports `CartService`.
- [ ] Register `CartModule` in `src/app.module.ts` imports.

### 6. Tests

- [ ] `src/modules/cart/cart.service.spec.ts` unit tests with mocked `TenantManagerService` and
  `R2Service` (follow the mock shape in `products.service.spec.ts:36`; add a `manager.transaction`
  mock that invokes its callback with the repo mocks). Cover:
  - empty cart (no row) returns zero totals and does not call `save`/`insert`;
  - merge on duplicate add increments quantity;
  - add rejected when product missing, `isActive` false, `stock === 0`, or target exceeds stock;
  - add rejected when target exceeds `MAX_CART_ITEM_QUANTITY`;
  - add rejected when the cart already has `MAX_CART_ITEMS` distinct items;
  - update rejected above `min(stock, MAX_CART_ITEM_QUANTITY)`, allowed to reduce an over-stock item;
  - read flags `isAvailable=false` when inactive or `quantity > stock`, without deleting;
  - item enrichment: `name`/`sku`/`unitPrice`, `imageUrl` from the lowest-`position` image, `null` when no
    images, and `imageUrl` built via `R2Service.publicUrl`;
  - totals/`round2` correctness (e.g. `price 19.99 × 3`);
  - remove/clear behavior, `clearCart` keeps the cart row, and 404s for items not in the caller's cart.
- [ ] Update `seed-data.spec.ts` as described in task 1.

## Validation

Run from repo root (implementation agent):

- `npx tsc --noEmit`
- `pnpm lint`
- `pnpm test` (includes the updated `seed-data.spec.ts` and new `cart.service.spec.ts`)
- `pnpm build`
- Manual/integration (needs `.env` + Postgres): register a customer on a tenant, login, then exercise the
  five endpoints. Confirm: adding the same product twice merges quantity; adding beyond stock returns 400;
  items include `name`/`sku`/`imageUrl` and correct `lineTotal`/`subtotal`; a second user's token sees an
  empty cart (owner isolation); `DELETE /cart` empties but a subsequent `GET` still succeeds.
  `TenantReseedService` backfills cart permissions on boot, so no migration is needed for existing tenants
  (tokens carry no permission claims — permissions are read live by `JwtGuard`).

## Risks / notes

- `synchronize: true` creates the new tables/indexes/FKs on next boot per tenant; no migrations exist.
  Existing ACTIVE tenants are covered by `TenantReseedService`.
- Concurrent adds can race the `userId` and `(cartId, productId)` unique indexes. The service wraps writes
  in a transaction and retries once on unique-violation; note Postgres aborts the whole transaction on a
  constraint error, so the retry must re-open the transaction (not reuse the aborted one).
- `PermissionKey` is a union consumed by the `Permissions` decorator
  (`src/modules/auth/decorators/permissions.decorator.ts:4`); `CartPermissionKey` must be added to the union
  or the decorator will not type-check.
- Cart permissions are granted to ADMIN too, per decision; because access is owner-scoped this only lets
  staff manage their own cart, not other users' carts. Deleting a user's account cascades to their cart;
  deleting a product cascades its lines out of all carts.
- `imageUrl` requires valid R2 config (`R2Service.publicUrl`); in unit tests mock it, and in dev without R2
  it may produce a non-resolvable URL without failing the request.
- `seed-data.spec.ts` is currently inconsistent with `seed-data.ts` for CUSTOMER (spec expects `[]`,
  seed grants `[ProductPermissionKey.READ]`); task 1 reconciles it.

## Out of scope

Guest carts, cart merge on login, checkout/orders, payment, stock reservation/decrement, price snapshots,
currency, staff/admin views of other users' carts, cart expiry/cleanup jobs, wishlists/multiple carts.
