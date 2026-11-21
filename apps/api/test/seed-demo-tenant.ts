import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { DemoTenantSeedService } from 'src/modules/seeding/demo-tenant/demo-tenant.seed.service';

const USAGE = `Usage: pnpm seed:demo-tenant [--force]

Options:
  --force  Required with SEED_ALLOW_PRODUCTION=true in production
  --help   Show this help
`;

const parseArgs = (args: string[]): { force: boolean; help: boolean } => {
  let force = false;
  let help = false;
  for (const arg of args) {
    if (arg === '--') continue;
    if (arg === '--force') force = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return { force, help };
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  process.env.SEED_CLI = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const service = app.get(DemoTenantSeedService);
    await service.run({
      force: args.force,
      onProgress: (message) => console.log(message),
    });
    process.exitCode = 0;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
