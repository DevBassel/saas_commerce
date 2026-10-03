import { DataSource, EntityManager } from 'typeorm';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { SeederContext } from './seeder.interface';

export interface TenantSeederContext extends SeederContext {
  tenant: Tenant;
  schemaName: string;
  /** The tenant's DataSource (never the public one). */
  dataSource: DataSource;
  /** Manager bound to the tenant DataSource transaction. */
  manager: EntityManager;
}

export interface TenantSeeder {
  readonly name: string;
  readonly order: number;
  /** When set, the seeder only runs in these environments. */
  readonly environments?: readonly string[];
  /** Opt-in seeders are skipped by "run all" and must be named explicitly. */
  readonly optIn?: boolean;
  run(context: TenantSeederContext): Promise<void>;
}
