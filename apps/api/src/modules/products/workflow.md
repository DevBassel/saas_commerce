```mermaid
flowchart TD
    Client["Client (tenant user / storefront)"] --> GUARDS["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]

    subgraph API["API — ProductsController /api/v1/products"]
        GUARDS --> RO{"route"}
        RO -->|"GET /products — @Public<br/>(storefront + dashboard)"| FA["findAll — images + category,<br/>newest first"]
        RO -->|"GET /products/:id — @Public"| FO["findOne — 404 if missing"]
        RO -->|"POST /products<br/>needs products:create"| CR["create — sku dup 400,<br/>categoryId must exist 400, unique slug"]
        RO -->|"PATCH /products/:id<br/>needs products:update"| UP["update — sku re-check, category check,<br/>slug refresh when name changes"]
        RO -->|"DELETE /products/:id<br/>needs products:delete"| RM["remove — deletes rows + R2 objects,<br/>releases storage"]
        RO -->|"POST /products/:id/images (multipart, files[])<br/>needs products:update"| UI["uploadImages — up to 5 files/request"]
        RO -->|"DELETE /products/:id/images/:imageId<br/>needs products:update"| DI["deleteImage — releases storage"]
        RO -->|"PATCH /products/:id/images/order<br/>needs products:update"| RI["reorderImages"]
    end

    subgraph APP["Application — ProductsService<br/>(see categories/workflow.md for category CRUD)"]
        SVC["All methods"] --> TRT{"tenant context<br/>(tenantStorage or arg)?"}
        TRT -->|"none"| TRTE["403 Tenant context required"]
        TRT -->|"resolved"| TM["TenantManagerService.getRepository<br/>Product, ProductImage<br/>(tenant schema only)"]
        CR --> CAT["CategoriesService.findById<br/>categoryId → 400 category not found"]
        UP --> CAT
        CR --> SLUG["ensureUniqueProductSlug(name, sku)"]
        UP --> SLUG
        UI --> R2S["R2Service.upload / deleteMany"]
        RM --> R2S
        DI --> R2S
        UI --> CAP["TenantService.adjustStorageUsedBytes(+bytes)"]
        RM --> CAP
        DI --> CAP
    end

    subgraph DATA["Data"]
        TM --> TDB[("PostgreSQL tenant schema<br/>products, product_images, categories")]
        CAP --> TEN[("PostgreSQL public schema<br/>tenants.storageUsedBytes / capacity")]
        R2S --> R2[("Cloudflare R2 bucket<br/>tenants/{schema}/products/{uuid}.{ext}")]
    end
```

---

```mermaid
flowchart TD
    UPIMG["uploadImages (productId, files[])"]
        U0{"1 <= files.length <= 5?"} -->|"no"| U0E["400 invalid file count"]
        U0 -->|"yes"| U1{"product exists?"} -->|"no"| U1E["404 Product not found"]
        U1 -->|"yes"| U2{"each file.size <= MAX_FILE_SIZE?"} -->|"no"| U2E["413 file exceeds max size"]
        U2 -->|"yes"| U3{"each mime in jpeg/png/webp/gif?"} -->|"no"| U3E["400 unsupported type"]
        U3 -->|"yes"| U4{"image count + files.length <= MAX_PRODUCT_IMAGES?"} -->|"no"| U4E["400 max images reached"]
        U4 -->|"yes"| U5{"storageUsedBytes + SUM(file.size) <= storageCapacityBytes?"} -->|"no"| U5E["400 Storage capacity exceeded"]
        U5 -->|"yes"| U6["R2 PutObject all files (parallel) →<br/>insert product_images rows<br/>position = max(position)+1..+n"]
        U6 --> U7["adjustStorageUsedBytes(schema, +totalBytes)"]
        U7 --> U8{"any upload / save failed?"} -->|"yes"| U8E["R2 deleteMany(uploaded keys),<br/>delete saved rows, rethrow"]
        U8 -->|"no"| U9["return findOne(productId)"]

    RMIMG["remove (productId)"]
        R1{"product exists with images?"} -->|"no"| R1E["404 Product not found"]
        R1 -->|"yes"| R2["delete product_images rows<br/>R2 deleteMany(objectKeys)<br/>adjustStorageUsedBytes(-sum)"]
        R2 --> R3["delete product<br/>(categoryId FK is SET NULL on the category side)"]

    DELIMG["deleteImage (productId, imageId)"]
        D1{"image belongs to product?"} -->|"no"| D1E["404 Image not found"]
        D1 -->|"yes"| D2["delete row, R2 deleteMany([objectKey]),<br/>adjustStorageUsedBytes(-sizeBytes)"]

    REORD["reorderImages (productId, imageIds)"]
        O1{"product exists?"} -->|"no"| O1E["404 Product not found"]
        O1 -->|"yes"| O2{"imageIds exactly match<br/>current image ids?"} -->|"no"| O2E["400 imageIds must match current ids"]
        O2 -->|"yes"| O3["position = array index per id"]
```

Slug rules (`products.slug.ts`): `slugifyProductName(name)` is the base; `ensureUniqueProductSlug` appends a numeric suffix when taken. A slug is generated when the product has none, and refreshed from the name on rename only when the new base slug is free (or owned by the same product). The storefront stores product URLs as `/products/<slug>`.
