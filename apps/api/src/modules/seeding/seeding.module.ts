import { Module } from '@nestjs/common';
import { TenantModule } from 'src/modules/tenants/tenant.module';
import { SubscriptionsModule } from 'src/modules/subscriptions/subscriptions.module';
import {
  PLATFORM_SEEDERS,
  TENANT_SEEDERS,
} from './constants/seeding.constants';
import { PlatformSeeder } from './interfaces/seeder.interface';
import { TenantSeeder } from './interfaces/tenant-seeder.interface';
import { SeederRegistry } from './seeder-registry.service';
import { SeedingService } from './seeding.service';
import { SeedingBootstrapService } from './seeding-bootstrap.service';
import { PlatformPermissionsSeeder } from './seeders/platform/permissions.seeder';
import { PlatformRolesSeeder } from './seeders/platform/roles.seeder';
import { SuperAdminSeeder } from './seeders/platform/super-admin.seeder';
import { SubscriptionPlansSeeder } from './seeders/platform/subscription-plans.seeder';
import { SubscriptionBackfillSeeder } from './seeders/platform/subscription-backfill.seeder';
import { TenantPermissionsSeeder } from './seeders/tenant/permissions.seeder';
import { TenantRolesSeeder } from './seeders/tenant/roles.seeder';
import { CategoriesSeeder } from './seeders/tenant/categories.seeder';

// Nest has no native multi-providers, so each seeder class is a normal provider
// and the arrays are assembled by the factory tokens below. Adding a seeder =
// add it to `providers` and to the matching factory.
@Module({
  imports: [TenantModule, SubscriptionsModule],
  providers: [
    PlatformPermissionsSeeder,
    PlatformRolesSeeder,
    SuperAdminSeeder,
    SubscriptionPlansSeeder,
    SubscriptionBackfillSeeder,
    TenantPermissionsSeeder,
    TenantRolesSeeder,
    CategoriesSeeder,
    {
      provide: PLATFORM_SEEDERS,
      useFactory: (
        permissions: PlatformPermissionsSeeder,
        roles: PlatformRolesSeeder,
        superAdmin: SuperAdminSeeder,
        plans: SubscriptionPlansSeeder,
        backfill: SubscriptionBackfillSeeder,
      ): PlatformSeeder[] => [permissions, roles, superAdmin, plans, backfill],
      inject: [
        PlatformPermissionsSeeder,
        PlatformRolesSeeder,
        SuperAdminSeeder,
        SubscriptionPlansSeeder,
        SubscriptionBackfillSeeder,
      ],
    },
    {
      provide: TENANT_SEEDERS,
      useFactory: (
        permissions: TenantPermissionsSeeder,
        roles: TenantRolesSeeder,
        categories: CategoriesSeeder,
      ): TenantSeeder[] => [permissions, roles, categories],
      inject: [TenantPermissionsSeeder, TenantRolesSeeder, CategoriesSeeder],
    },
    SeederRegistry,
    SeedingService,
    SeedingBootstrapService,
  ],
  exports: [SeedingService, SeederRegistry],
})
export class SeedingModule {}
