import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SeedingService } from '../src/modules/seeding/seeding.service';

type SeedMode = 'platform' | 'tenants' | 'all';

interface CliArgs {
  platform: boolean;
  tenants: boolean;
  all: boolean;
  names: string[];
  targets: string[];
  force: boolean;
  help: boolean;
}

const USAGE = `Usage: seed [--platform | --tenants | --all] [options]

Runs database seeders through the seeding registry. Default (no mode flag)
seeds the platform (public schema) then every ACTIVE tenant.

Modes:
  --platform            Run platform (public schema) seeders only
  --tenants             Run tenant seeders for every ACTIVE tenant
  --all                 Run platform then tenant seeders (default)

Options:
  --name <n>            Limit to a seeder name (repeatable or comma-separated)
  --tenant <id|slug>    Target a single tenant by id or slug (repeatable)
  --force               Continue past the inactive-tenant guard; required in
                        production alongside SEED_ALLOW_PRODUCTION=true
  -h, --help            Show this help

Examples:
  seed --platform
  seed --tenants --name roles
  seed --name permissions
  seed --tenant demo`;

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    platform: false,
    tenants: false,
    all: false,
    names: [],
    targets: [],
    force: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--platform':
        args.platform = true;
        break;
      case '--tenants':
        args.tenants = true;
        break;
      case '--all':
        args.all = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '--name': {
        const value = argv[++index];
        if (!value) throw new Error('--name requires a value');
        args.names.push(...splitList(value));
        break;
      }
      case '--tenant': {
        const value = argv[++index];
        if (!value) throw new Error('--tenant requires a value');
        args.targets.push(value);
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
};

const resolveMode = (args: CliArgs): SeedMode => {
  if (args.all || (args.platform && args.tenants)) return 'all';
  if (args.platform) return 'platform';
  if (args.tenants || args.targets.length > 0) return 'tenants';
  return 'all';
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const mode = resolveMode(args);

  // Tell the boot seeder to stay out of the way; this process drives seeding.
  process.env.SEED_CLI = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const seeding = app.get(SeedingService);

    const common = { names: args.names, force: args.force };
    const result =
      mode === 'platform'
        ? await seeding.runPlatform(common)
        : mode === 'tenants'
          ? await seeding.runTenants({
              ...common,
              slugs: args.targets.filter((target) => !/^\d+$/.test(target)),
              tenantIds: args.targets
                .filter((target) => /^\d+$/.test(target))
                .map((target) => Number(target)),
              allActive: args.targets.length === 0,
            })
          : await seeding.runAll(common);

    console.log(
      `Seed complete: ${result.ran.length} seeder run(s), ${result.failures.length} failure(s).`,
    );
    for (const failure of result.failures) {
      const tenant = failure.tenant
        ? ` tenant=${failure.tenant.slug} (${failure.tenant.schemaName})`
        : '';
      console.error(
        `FAILED ${failure.scope}/${failure.seeder}${tenant}: ${String(failure.error)}`,
      );
    }

    process.exitCode = result.failures.length > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
