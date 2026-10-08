import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TenantService } from '../src/modules/tenants/tenant.service';
import { TenantProvisionerService } from '../src/modules/tenants/services/tenant-provisioner.service';
import { TenantManagerService } from '../src/modules/tenants/services/tenant-manager.service';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { UsersService } from '../src/modules/users/users.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { EmailService } from '../src/modules/email/email.service';
import { tenantStorage } from '../src/modules/auth/tenant-context';
import { RoleKey } from '../src/common/constants/RoleKey.enum';
import { OtpPurpose } from '../src/modules/email-otp/constants/otp-purpose.enum';

process.env.OTP_RESEND_COOLDOWN_SECONDS = '0';
process.env.OTP_MAX_REQUESTS = '50';
process.env.EMAIL_PROVIDER = 'memory';

const SLUG = 'verify-otp';
const EMAIL = 'otp-verify@test.dev';
const PASSWORD = 'password1';

const assert = (cond: unknown, msg: string): void => {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok - ${msg}`);
};

const errorCode = (error: unknown): string | undefined =>
  (error as { getResponse?: () => { code?: string } })?.getResponse?.()?.code;

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const publicDs = app.get(DataSource);
  const tenantService = app.get(TenantService);
  const provisioner = app.get(TenantProvisionerService);
  const manager = app.get(TenantManagerService);
  const usersService = app.get(UsersService);
  const authService = app.get(AuthService);
  const emailService = app.get(EmailService);

  let lastOtp: { code: string; purpose: string; to: string } | null = null;
  (emailService as unknown as Record<string, unknown>).sendOtpEmail = (params: {
    code: string;
    purpose: string;
    to: string;
  }): Promise<void> => {
    lastOtp = params;
    return Promise.resolve();
  };

  let tenant = await tenantService.findBySlug(SLUG);
  if (!tenant) {
    tenant = await tenantService.create({ name: 'Verify OTP', slug: SLUG });
  }
  await provisioner.provision(tenant);
  const schema = tenant.schemaName;
  console.log(`tenant ready: id=${tenant.id} schema=${schema}`);

  await usersService.create(
    { name: 'OTP User', email: EMAIL, password: PASSWORD },
    RoleKey.CUSTOMER,
    tenant,
  );

  const run = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantStorage.run({ tenant: tenant, tenantSchema: schema }, fn);

  // 1. request -> verify sets emailVerified
  await run(async () => {
    await authService.requestEmailOtp({
      email: EMAIL,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
    });
    assert(!!lastOtp, 'verification OTP dispatched');
    const code = lastOtp!.code;

    const result = await authService.verifyEmailOtp({
      email: EMAIL,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      code,
    });
    assert(
      (result as { verified?: boolean }).verified === true,
      'verify returns verified=true',
    );

    const user = await usersService.findOne({ email: EMAIL }, {}, tenant);
    assert(user?.emailVerified === true, 'user.emailVerified became true');

    // 2. replay the consumed code
    const replay = await authService
      .verifyEmailOtp({
        email: EMAIL,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        code,
      })
      .catch((error: unknown) => error);
    assert(
      errorCode(replay) === 'OTP_ALREADY_USED',
      'a replayed code returns OTP_ALREADY_USED',
    );

    // 3. a new request replaces the previous code
    await authService.requestEmailOtp({
      email: EMAIL,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
    });
    const newCode = lastOtp!.code;
    assert(newCode !== code, 'resend issued a different code');

    const stale = await authService
      .verifyEmailOtp({
        email: EMAIL,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        code,
      })
      .catch((error: unknown) => error);
    assert(
      errorCode(stale) === 'OTP_INVALID',
      'the superseded code is rejected',
    );

    await authService.verifyEmailOtp({
      email: EMAIL,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      code: newCode,
    });
    console.log('  ok - the replacement code verifies');
  });

  // 4. password reset
  await run(async () => {
    await authService.requestEmailOtp({
      email: EMAIL,
      purpose: OtpPurpose.PASSWORD_RESET,
    });
    assert(!!lastOtp, 'password reset OTP dispatched');
    const code = lastOtp!.code;

    const result = await authService.confirmPasswordReset({
      email: EMAIL,
      code,
      newPassword: 'newpass12',
    });
    assert(
      (result as { success?: boolean }).success === true,
      'password reset confirmed',
    );

    const oldLogin = await authService
      .login({ email: EMAIL, password: PASSWORD })
      .catch((error: unknown) => error);
    assert(oldLogin instanceof Error, 'old password no longer logs in');

    const newLogin = await authService.login({
      email: EMAIL,
      password: 'newpass12',
    });
    assert(
      typeof (newLogin as { access_token?: string }).access_token === 'string',
      'new password logs in',
    );

    const user = await usersService.findOne({ email: EMAIL }, {}, tenant);
    assert(user?.jti == null, 'refresh sessions revoked (jti cleared)');
  });

  await manager.release(tenant);
  await publicDs.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await publicDs.getRepository(Tenant).delete({ id: tenant.id });
  console.log('cleanup done (schema dropped, tenant row deleted)');

  await app.close();
  console.log('VERIFY EMAIL OTP: PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
