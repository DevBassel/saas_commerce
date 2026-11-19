import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialTenant1795099463316 implements MigrationInterface {
  name = 'InitialTenant1795099463316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."permissions" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_017943867ed5ceef9c03edd974" ON "__tenant_schema__"."permissions" ("key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."roles" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "isSystem" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a87cf0659c3ac379b339acf36a" ON "__tenant_schema__"."roles" ("key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."user" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "roleId" integer, "emailVerified" boolean NOT NULL DEFAULT false, "jti" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "__tenant_schema__"."user" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."product_images" ("id" SERIAL NOT NULL, "productId" integer NOT NULL, "objectKey" character varying NOT NULL, "sizeBytes" bigint NOT NULL, "mimeType" character varying NOT NULL, "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1974264ea7265989af8392f63a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_77d245a524a076317245280de4" ON "__tenant_schema__"."product_images" ("objectKey") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."categories" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "__tenant_schema__"."categories" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."products" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "sku" character varying NOT NULL, "slug" character varying, "description" text, "price" numeric(10,2) NOT NULL, "stock" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "categoryId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c44ac33a05b144dd0d9ddcf932" ON "__tenant_schema__"."products" ("sku") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_464f927ae360106b783ed0b410" ON "__tenant_schema__"."products" ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff56834e735fa78a15d0cf2192" ON "__tenant_schema__"."products" ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."cart_items" ("id" SERIAL NOT NULL, "cartId" integer NOT NULL, "productId" integer NOT NULL, "quantity" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2bf7996b7946ce753b60a87468" ON "__tenant_schema__"."cart_items" ("cartId", "productId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."carts" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b5f695a59f5ebb50af3c8160816" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_69828a178f152f157dcf2f70a8" ON "__tenant_schema__"."carts" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."addresses" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "recipientName" character varying(255) NOT NULL, "phone" character varying(50) NOT NULL, "line1" character varying(255) NOT NULL, "line2" character varying(255), "city" character varying(120) NOT NULL, "state" character varying(120), "postalCode" character varying(32) NOT NULL, "country" character varying(2) NOT NULL, "label" character varying(60), "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_745d8f43d3af10ab8247465e450" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_95c93a584de49f0b0e13f75363" ON "__tenant_schema__"."addresses" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a11bc3cf46bc3e9d2902f4b3fc" ON "__tenant_schema__"."addresses" ("userId") WHERE "isDefault" = true`,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."coupon_redemptions" ("id" SERIAL NOT NULL, "couponId" integer NOT NULL, "userId" integer NOT NULL, "orderId" integer NOT NULL, "discountAmount" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5086813ea980d21dbeb190ed0a7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_26b8ad24ace2974b2b6c2047d3" ON "__tenant_schema__"."coupon_redemptions" ("couponId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_21b5ef20634735e39029e178e7" ON "__tenant_schema__"."coupon_redemptions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eb006863ca6bbcdeb8ec948ee8" ON "__tenant_schema__"."coupon_redemptions" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5dc1ed1db4e367f0257ddaca3a" ON "__tenant_schema__"."coupon_redemptions" ("couponId", "userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_195576230b3b40f09f2b173c20" ON "__tenant_schema__"."coupon_redemptions" ("couponId", "orderId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."coupons_discounttype_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."coupons" ("id" SERIAL NOT NULL, "code" character varying(64) NOT NULL, "description" text, "discountType" "__tenant_schema__"."coupons_discounttype_enum" NOT NULL, "discountValue" numeric(10,2) NOT NULL, "minOrderAmount" numeric(10,2) NOT NULL DEFAULT '0', "maxDiscountAmount" numeric(10,2), "usageLimit" integer, "perUserLimit" integer, "usageCount" integer NOT NULL DEFAULT '0', "startsAt" TIMESTAMP, "expiresAt" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e025109230e82925843f2a14c4" ON "__tenant_schema__"."coupons" ("code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b761d5df4a4c913a481ef741ef" ON "__tenant_schema__"."coupons" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3650fd30e88e27baa3a88e1e9f" ON "__tenant_schema__"."coupons" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."order_items" ("id" SERIAL NOT NULL, "orderId" integer NOT NULL, "productId" integer, "name" character varying NOT NULL, "sku" character varying NOT NULL, "unitPrice" numeric(10,2) NOT NULL, "quantity" integer NOT NULL, "lineTotal" numeric(10,2) NOT NULL, "imageObjectKey" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1d359a55923bb45b057fbdab0" ON "__tenant_schema__"."order_items" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cdb99c05982d5191ac8465ac01" ON "__tenant_schema__"."order_items" ("productId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."orders_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."orders_paymentstatus_enum" AS ENUM('CANCELED', 'PENDING', 'UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."orders_coupondiscounttype_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."orders" ("id" SERIAL NOT NULL, "orderNumber" character varying NOT NULL, "userId" integer, "status" "__tenant_schema__"."orders_status_enum" NOT NULL DEFAULT 'PENDING', "paymentStatus" "__tenant_schema__"."orders_paymentstatus_enum" NOT NULL DEFAULT 'UNPAID', "subtotal" numeric(10,2) NOT NULL, "total" numeric(10,2) NOT NULL, "couponId" integer, "couponCode" character varying(64), "couponDiscountType" "__tenant_schema__"."orders_coupondiscounttype_enum", "couponDiscountValue" numeric(10,2), "discountAmount" numeric(10,2) NOT NULL DEFAULT '0', "paidAt" TIMESTAMP, "refundedAt" TIMESTAMP, "addressId" integer, "recipientName" character varying(255), "phone" character varying(50), "line1" character varying(255), "line2" character varying(255), "city" character varying(120), "state" character varying(120), "postalCode" character varying(32), "country" character varying(2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_59b0c3b34ea0fa5562342f2414" ON "__tenant_schema__"."orders" ("orderNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_151b79a83ba240b0cb31b2302d" ON "__tenant_schema__"."orders" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c26db6c65929ecfeab91073e80" ON "__tenant_schema__"."orders" ("couponId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_37636d260931dcf46d11892f61" ON "__tenant_schema__"."orders" ("addressId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."payments_provider_enum" AS ENUM('stripe', 'paypal')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."payments_status_enum" AS ENUM('CANCELED', 'PENDING', 'UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."payments" ("id" SERIAL NOT NULL, "orderId" integer NOT NULL, "provider" "__tenant_schema__"."payments_provider_enum" NOT NULL, "status" "__tenant_schema__"."payments_status_enum" NOT NULL DEFAULT 'UNPAID', "amount" numeric(10,2) NOT NULL, "paymentRef" character varying, "refundedAmount" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL, "providerReference" character varying, "refundReference" character varying, "failureReason" character varying, "paidAt" TIMESTAMP, "refundedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_af929a5f2a400fdb6913b4967e" ON "__tenant_schema__"."payments" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."otp_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer NOT NULL, "email" character varying(320) NOT NULL, "purpose" character varying(32) NOT NULL, "codeHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "maxAttempts" integer NOT NULL, "requestCount" integer NOT NULL DEFAULT '1', "lastSentAt" TIMESTAMP WITH TIME ZONE, "consumedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c34f21df6c8aa51229715452068" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76ee90684ace18fe71e2cccb3a" ON "__tenant_schema__"."otp_challenges" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd376a0c34234bd1e9b9453600" ON "__tenant_schema__"."otp_challenges" ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7126bbcca780d13343c72d131c" ON "__tenant_schema__"."otp_challenges" ("userId", "purpose") WHERE "consumedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."role_permissions" ("rolesId" integer NOT NULL, "permissionsId" integer NOT NULL, CONSTRAINT "PK_7931614007a93423204b4b73240" PRIMARY KEY ("rolesId", "permissionsId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0cb93c5877d37e954e2aa59e52" ON "__tenant_schema__"."role_permissions" ("rolesId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d422dabc78ff74a8dab6583da0" ON "__tenant_schema__"."role_permissions" ("permissionsId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."user_permissions" ("userId" integer NOT NULL, "permissionsId" integer NOT NULL, CONSTRAINT "PK_f0aed043ca20329d6d61f4c6dea" PRIMARY KEY ("userId", "permissionsId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f05ccc7935f14874d7f89ba030" ON "__tenant_schema__"."user_permissions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d68e45e4cd82c8fa4730e30cac" ON "__tenant_schema__"."user_permissions" ("permissionsId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "__tenant_schema__"."roles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."product_images" ADD CONSTRAINT "FK_b367708bf720c8dd62fc6833161" FOREIGN KEY ("productId") REFERENCES "__tenant_schema__"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."products" ADD CONSTRAINT "FK_ff56834e735fa78a15d0cf21926" FOREIGN KEY ("categoryId") REFERENCES "__tenant_schema__"."categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."cart_items" ADD CONSTRAINT "FK_edd714311619a5ad09525045838" FOREIGN KEY ("cartId") REFERENCES "__tenant_schema__"."carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."cart_items" ADD CONSTRAINT "FK_72679d98b31c737937b8932ebe6" FOREIGN KEY ("productId") REFERENCES "__tenant_schema__"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."carts" ADD CONSTRAINT "FK_69828a178f152f157dcf2f70a89" FOREIGN KEY ("userId") REFERENCES "__tenant_schema__"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."addresses" ADD CONSTRAINT "FK_95c93a584de49f0b0e13f753630" FOREIGN KEY ("userId") REFERENCES "__tenant_schema__"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."coupon_redemptions" ADD CONSTRAINT "FK_26b8ad24ace2974b2b6c2047d3a" FOREIGN KEY ("couponId") REFERENCES "__tenant_schema__"."coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."coupon_redemptions" ADD CONSTRAINT "FK_eb006863ca6bbcdeb8ec948ee8c" FOREIGN KEY ("orderId") REFERENCES "__tenant_schema__"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "__tenant_schema__"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_items" ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES "__tenant_schema__"."products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" ADD CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1" FOREIGN KEY ("userId") REFERENCES "__tenant_schema__"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" ADD CONSTRAINT "FK_c26db6c65929ecfeab91073e80c" FOREIGN KEY ("couponId") REFERENCES "__tenant_schema__"."coupons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" ADD CONSTRAINT "FK_37636d260931dcf46d11892f614" FOREIGN KEY ("addressId") REFERENCES "__tenant_schema__"."addresses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."payments" ADD CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1" FOREIGN KEY ("orderId") REFERENCES "__tenant_schema__"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."otp_challenges" ADD CONSTRAINT "FK_76ee90684ace18fe71e2cccb3a8" FOREIGN KEY ("userId") REFERENCES "__tenant_schema__"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."role_permissions" ADD CONSTRAINT "FK_0cb93c5877d37e954e2aa59e52c" FOREIGN KEY ("rolesId") REFERENCES "__tenant_schema__"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."role_permissions" ADD CONSTRAINT "FK_d422dabc78ff74a8dab6583da02" FOREIGN KEY ("permissionsId") REFERENCES "__tenant_schema__"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user_permissions" ADD CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f" FOREIGN KEY ("userId") REFERENCES "__tenant_schema__"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user_permissions" ADD CONSTRAINT "FK_d68e45e4cd82c8fa4730e30cacd" FOREIGN KEY ("permissionsId") REFERENCES "__tenant_schema__"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user_permissions" DROP CONSTRAINT "FK_d68e45e4cd82c8fa4730e30cacd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user_permissions" DROP CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."role_permissions" DROP CONSTRAINT "FK_d422dabc78ff74a8dab6583da02"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."role_permissions" DROP CONSTRAINT "FK_0cb93c5877d37e954e2aa59e52c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."otp_challenges" DROP CONSTRAINT "FK_76ee90684ace18fe71e2cccb3a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."payments" DROP CONSTRAINT "FK_af929a5f2a400fdb6913b4967e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" DROP CONSTRAINT "FK_37636d260931dcf46d11892f614"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" DROP CONSTRAINT "FK_c26db6c65929ecfeab91073e80c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" DROP CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."coupon_redemptions" DROP CONSTRAINT "FK_eb006863ca6bbcdeb8ec948ee8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."coupon_redemptions" DROP CONSTRAINT "FK_26b8ad24ace2974b2b6c2047d3a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."addresses" DROP CONSTRAINT "FK_95c93a584de49f0b0e13f753630"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."carts" DROP CONSTRAINT "FK_69828a178f152f157dcf2f70a89"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."cart_items" DROP CONSTRAINT "FK_72679d98b31c737937b8932ebe6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."cart_items" DROP CONSTRAINT "FK_edd714311619a5ad09525045838"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."products" DROP CONSTRAINT "FK_ff56834e735fa78a15d0cf21926"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."product_images" DROP CONSTRAINT "FK_b367708bf720c8dd62fc6833161"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_d68e45e4cd82c8fa4730e30cac"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_f05ccc7935f14874d7f89ba030"`,
    );
    await queryRunner.query(
      `DROP TABLE "__tenant_schema__"."user_permissions"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_d422dabc78ff74a8dab6583da0"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_0cb93c5877d37e954e2aa59e52"`,
    );
    await queryRunner.query(
      `DROP TABLE "__tenant_schema__"."role_permissions"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_7126bbcca780d13343c72d131c"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_cd376a0c34234bd1e9b9453600"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_76ee90684ace18fe71e2cccb3a"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."otp_challenges"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_af929a5f2a400fdb6913b4967e"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."payments"`);
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."payments_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."payments_provider_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_37636d260931dcf46d11892f61"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_c26db6c65929ecfeab91073e80"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_151b79a83ba240b0cb31b2302d"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_59b0c3b34ea0fa5562342f2414"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."orders"`);
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."orders_coupondiscounttype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."orders_paymentstatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."orders_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_cdb99c05982d5191ac8465ac01"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_f1d359a55923bb45b057fbdab0"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."order_items"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_3650fd30e88e27baa3a88e1e9f"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_b761d5df4a4c913a481ef741ef"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_e025109230e82925843f2a14c4"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."coupons"`);
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."coupons_discounttype_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_195576230b3b40f09f2b173c20"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_5dc1ed1db4e367f0257ddaca3a"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_eb006863ca6bbcdeb8ec948ee8"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_21b5ef20634735e39029e178e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_26b8ad24ace2974b2b6c2047d3"`,
    );
    await queryRunner.query(
      `DROP TABLE "__tenant_schema__"."coupon_redemptions"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_a11bc3cf46bc3e9d2902f4b3fc"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_95c93a584de49f0b0e13f75363"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."addresses"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_69828a178f152f157dcf2f70a8"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."carts"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_2bf7996b7946ce753b60a87468"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."cart_items"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_ff56834e735fa78a15d0cf2192"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_464f927ae360106b783ed0b410"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_c44ac33a05b144dd0d9ddcf932"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."products"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_420d9f679d41281f282f5bc7d0"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."categories"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_77d245a524a076317245280de4"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."product_images"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_e12875dfb3b1d92d7d7c5377e2"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."user"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_a87cf0659c3ac379b339acf36a"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."roles"`);
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_017943867ed5ceef9c03edd974"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."permissions"`);
  }

  private forConfiguredSchema(queryRunner: QueryRunner): QueryRunner {
    const schema = (queryRunner.connection.options as { schema?: string })
      .schema;
    if (!schema || !/^tenant_[a-z0-9_]{1,56}$/.test(schema)) {
      throw new Error(
        `Invalid tenant migration schema: ${schema ?? '<unset>'}`,
      );
    }

    const scopedRunner = Object.create(queryRunner) as QueryRunner;
    scopedRunner.query = (sql: string, parameters?: unknown[]) =>
      queryRunner.query(
        sql.replaceAll('"__tenant_schema__"', `"${schema}"`),
        parameters,
      );
    return scopedRunner;
  }
}
