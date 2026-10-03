import { DataSource } from 'typeorm';

export interface SeederContext {
  /** Public-schema DataSource. */
  dataSource: DataSource;
  /** Current NODE_ENV. */
  environment: string;
}

export interface PlatformSeeder {
  readonly name: string;
  readonly order: number;
  /** When set, the seeder only runs in these environments. */
  readonly environments?: readonly string[];
  /** Opt-in seeders are skipped by "run all" and must be named explicitly. */
  readonly optIn?: boolean;
  run(context: SeederContext): Promise<void>;
}
