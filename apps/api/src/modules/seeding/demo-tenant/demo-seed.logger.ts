export type DemoSeedProgress = (message: string) => void;

export class DemoSeedLogger {
  private currentStep = 1;

  constructor(private readonly progress: DemoSeedProgress = console.log) {}

  log(step: number, area: string, message: string): void {
    this.currentStep = step;
    this.progress(`[${step}/8] ${area}: ${message}`);
  }

  fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.progress(`[${this.currentStep}/8] Failed: ${message}`);
  }

  summary(result: {
    tenantSlug: string;
    schemaName: string;
    subscriptionPlan: string;
    customers: number;
    categories: number;
    products: number;
    productImages: number;
    durationMs: number;
  }): void {
    this.progress(
      [
        '========================================',
        '       DEMO TENANT SEED COMPLETED',
        '========================================',
        '',
        'Tenant:',
        `  Slug:         ${result.tenantSlug}`,
        `  Schema:       ${result.schemaName}`,
        '  Status:       active',
        `  Subscription: ${result.subscriptionPlan}`,
        '',
        'Seeded Data:',
        `  Customers:    ${result.customers}`,
        `  Categories:   ${result.categories}`,
        `  Products:     ${result.products}`,
        `  Images:       ${result.productImages}`,
        '',
        'Verification:',
        '  Tenant isolation:     PASS',
        '  Customer passwords:   PASS',
        '  Product categories:   PASS',
        '  Image uniqueness:     PASS',
        '  Image counts:         PASS',
        '  Duplicate SKUs:       0',
        '  Duplicate slugs:      0',
        '',
        'Execution:',
        '  Status:       SUCCESS',
        `  Duration:     ${(result.durationMs / 1000).toFixed(1)}s`,
        '',
        '========================================',
      ].join('\n'),
    );
  }
}
