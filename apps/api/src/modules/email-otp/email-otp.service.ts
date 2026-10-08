import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { IsNull, MoreThanOrEqual } from 'typeorm';
import { IENV, IOtp } from 'src/common/config/env.interface';
import { isUniqueViolation } from 'src/common/db/unique-retry';
import { getTenantContext } from 'src/modules/auth/tenant-context';
import { TenantManagerService } from 'src/modules/tenants/services/tenant-manager.service';
import { resolveTenantScope } from 'src/modules/tenants/utils/tenant-scope';
import { TenantRef } from 'src/modules/tenants/utils/tenant.utils';
import { EmailService } from 'src/modules/email/email.service';
import { User } from 'src/modules/users/entities/user.entity';
import { OtpErrorCode, otpError } from './constants/otp.constants';
import { OtpPurpose } from './constants/otp-purpose.enum';
import { OtpChallenge } from './entities/otp-challenge.entity';
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
} from './utils/otp-code.util';

export interface RequestOtpInput {
  email: string;
  purpose: OtpPurpose;
  tenant?: TenantRef;
}

export interface VerifyOtpInput {
  email: string;
  purpose: OtpPurpose;
  code: string;
  tenant?: TenantRef;
}

export interface VerifiedOtp {
  challenge: OtpChallenge;
  user: User;
}

type VerifyOutcome =
  { ok: true; result: VerifiedOtp } | { ok: false; error: OtpErrorCode };

/**
 * Owns OTP generation, storage, throttling counters and atomic consumption.
 * Purpose-specific flows call this service and apply the resulting effect; they
 * never re-implement OTP logic.
 */
@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService<IENV>,
  ) {}

  async request(input: RequestOtpInput): Promise<{ success: true }> {
    const target = resolveTenantScope(input.tenant);
    const otp = this.config.getOrThrow<IOtp>('otp');

    const [challengeRepo, userRepo] = await Promise.all([
      this.tenantManager.getRepository(OtpChallenge, target),
      this.tenantManager.getRepository(User, target),
    ]);

    const user = await userRepo.findOneBy({ email: input.email });
    // Anti-enumeration: unknown emails get the same generic response and no send.
    if (!user) return { success: true };

    const now = new Date();

    const windowStart = new Date(
      now.getTime() - otp.requestWindowSeconds * 1000,
    );
    const windowCount = await challengeRepo.count({
      where: {
        userId: user.id,
        purpose: input.purpose,
        createdAt: MoreThanOrEqual(windowStart),
      },
    });
    if (windowCount >= otp.maxRequests) return { success: true };

    const active = await challengeRepo.findOne({
      where: { userId: user.id, purpose: input.purpose },
      order: { createdAt: 'DESC' },
    });
    if (
      active?.lastSentAt &&
      now.getTime() - active.lastSentAt.getTime() <
        otp.resendCooldownSeconds * 1000
    ) {
      return { success: true };
    }

    const id = randomUUID();
    const code = generateOtpCode(otp.length);
    const codeHash = hashOtpCode(otp.hashSecret, id, code);
    const expiresAt = new Date(now.getTime() + otp.expirationSeconds * 1000);

    let created = false;
    try {
      await challengeRepo.manager.transaction(async (manager) => {
        const repo = manager.getRepository(OtpChallenge);
        await repo.update(
          { userId: user.id, purpose: input.purpose, consumedAt: IsNull() },
          { consumedAt: now },
        );
        await repo.insert(
          repo.create({
            id,
            userId: user.id,
            email: input.email,
            purpose: input.purpose,
            codeHash,
            expiresAt,
            attempts: 0,
            maxAttempts: otp.maxAttempts,
            requestCount: windowCount + 1,
            lastSentAt: now,
            consumedAt: null,
          }),
        );
      });
      created = true;
    } catch (error) {
      // A concurrent request won the (userId, purpose) active-challenge race.
      if (!isUniqueViolation(error)) throw error;
    }

    if (!created) return { success: true };

    try {
      await this.emailService.sendOtpEmail({
        to: user.email,
        code,
        purpose: input.purpose,
        expiresInSeconds: otp.expirationSeconds,
        storeName: getTenantContext()?.tenant?.name,
      });
    } catch {
      this.logger.error(
        `OTP email delivery failed for user=${user.id} purpose=${input.purpose}`,
      );
    }

    return { success: true };
  }

  async verify(input: VerifyOtpInput): Promise<VerifiedOtp> {
    const target = resolveTenantScope(input.tenant);
    const otp = this.config.getOrThrow<IOtp>('otp');

    const [challengeRepo, userRepo] = await Promise.all([
      this.tenantManager.getRepository(OtpChallenge, target),
      this.tenantManager.getRepository(User, target),
    ]);

    const user = await userRepo.findOneBy({ email: input.email });
    if (!user) throw otpError(OtpErrorCode.INVALID);

    const outcome = await challengeRepo.manager.transaction(
      async (manager): Promise<VerifyOutcome> => {
        const repo = manager.getRepository(OtpChallenge);
        const challenge = await repo
          .createQueryBuilder('challenge')
          .where('challenge.userId = :userId', { userId: user.id })
          .andWhere('challenge.purpose = :purpose', { purpose: input.purpose })
          .orderBy('challenge.createdAt', 'DESC')
          .setLock('pessimistic_write')
          .limit(1)
          .getOne();

        if (!challenge) return { ok: false, error: OtpErrorCode.INVALID };
        if (challenge.consumedAt != null) {
          return { ok: false, error: OtpErrorCode.ALREADY_USED };
        }

        const now = new Date();
        if (challenge.expiresAt.getTime() <= now.getTime()) {
          return { ok: false, error: OtpErrorCode.EXPIRED };
        }
        if (challenge.attempts >= challenge.maxAttempts) {
          return { ok: false, error: OtpErrorCode.TOO_MANY_ATTEMPTS };
        }

        const matches = verifyOtpCode(
          otp.hashSecret,
          challenge.id,
          input.code,
          challenge.codeHash,
        );
        if (!matches) {
          await repo.increment({ id: challenge.id }, 'attempts', 1);
          return { ok: false, error: OtpErrorCode.INVALID };
        }

        await repo.update({ id: challenge.id }, { consumedAt: now });
        challenge.consumedAt = now;
        return { ok: true, result: { challenge, user } };
      },
    );

    if (!outcome.ok) throw otpError(outcome.error);
    return outcome.result;
  }
}
