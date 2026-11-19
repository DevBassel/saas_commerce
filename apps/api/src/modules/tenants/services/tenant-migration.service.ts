import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { assertTenantSchemaName } from 'src/database/data-source-options';
import { TenantManagerService } from './tenant-manager.service';

export interface TenantMigrationResult {
  schemaName: string;
  executedMigrations: string[];
}

@Injectable()
export class TenantMigrationService {
  private readonly logger = new Logger(TenantMigrationService.name);
  private readonly pending = new Map<string, Promise<TenantMigrationResult>>();

  constructor(
    private readonly manager: TenantManagerService,
    @InjectDataSource() private readonly platformDataSource: DataSource,
  ) {}

  migrate(schemaName: string): Promise<TenantMigrationResult> {
    const schema = assertTenantSchemaName(schemaName);
    const inflight = this.pending.get(schema);
    if (inflight) return inflight;

    const migration = this.runMigrations(schema).finally(() => {
      this.pending.delete(schema);
    });
    this.pending.set(schema, migration);
    return migration;
  }

  private async runMigrations(
    schemaName: string,
  ): Promise<TenantMigrationResult> {
    const lockRunner = this.platformDataSource.createQueryRunner();
    const lockName = `saas-commerce:tenant-migrations:${schemaName}`;
    let migrationDataSource: DataSource | undefined;
    let locked = false;
    let operationError: unknown;
    let result: TenantMigrationResult | undefined;

    try {
      await lockRunner.connect();
      await this.acquireLock(lockRunner, lockName);
      locked = true;

      await lockRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await this.manager.release({ schemaName });

      migrationDataSource = this.manager.createMigrationDataSource({
        schemaName,
      });
      await migrationDataSource.initialize();
      const migrations = await migrationDataSource.runMigrations({
        transaction: 'each',
      });
      const executedMigrations = migrations.map((migration) => migration.name);

      if (executedMigrations.length === 0) {
        this.logger.log(`Tenant ${schemaName} is already up to date`);
      } else {
        this.logger.log(
          `Tenant ${schemaName} executed migrations: ${executedMigrations.join(', ')}`,
        );
      }

      result = { schemaName, executedMigrations };
    } catch (error) {
      operationError = error;
      this.logger.error(
        `Tenant migration failed for ${schemaName}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    const cleanupErrors: unknown[] = [];
    try {
      if (migrationDataSource?.isInitialized) {
        await migrationDataSource.destroy();
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      if (locked) await this.releaseLock(lockRunner, lockName);
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      if (!lockRunner.isReleased) await lockRunner.release();
    } catch (error) {
      cleanupErrors.push(error);
    }

    const cleanupError =
      cleanupErrors.length > 0
        ? new AggregateError(
            cleanupErrors,
            `Tenant migration cleanup failed for ${schemaName}`,
          )
        : undefined;
    if (operationError) {
      if (cleanupError) {
        this.logger.error(cleanupError.message, cleanupError.stack);
      }
      throw operationError instanceof Error
        ? operationError
        : new Error('Non-Error tenant migration failure', {
            cause: operationError,
          });
    }
    if (cleanupError) throw cleanupError;
    if (!result)
      throw new Error(`Tenant migration produced no result: ${schemaName}`);
    return result;
  }

  private async acquireLock(
    queryRunner: QueryRunner,
    lockName: string,
  ): Promise<void> {
    await queryRunner.query(
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      [lockName],
    );
  }

  private async releaseLock(
    queryRunner: QueryRunner,
    lockName: string,
  ): Promise<void> {
    await queryRunner.query(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      [lockName],
    );
  }
}
