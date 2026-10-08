import { BadRequestException } from '@nestjs/common';
import { EmailOtpService } from './email-otp.service';
import { OtpErrorCode } from './constants/otp.constants';
import { OtpPurpose } from './constants/otp-purpose.enum';
import { User } from 'src/modules/users/entities/user.entity';
import { hashOtpCode } from './utils/otp-code.util';

const SECRET = `otp_${'a'.repeat(40)}`;

const otpConfig = {
  length: 6,
  expirationSeconds: 600,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  maxRequests: 5,
  requestWindowSeconds: 3600,
  hashSecret: SECRET,
  requireEmailVerified: false,
};

const config = {
  getOrThrow: jest.fn().mockReturnValue(otpConfig),
};

const TENANT = { schemaName: 'tenant_acme' };

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 7,
    email: 'jane@test.dev',
    emailVerified: false,
    ...overrides,
  }) as unknown as User;

const makeChallenge = (overrides: Record<string, unknown> = {}) => ({
  id: 'challenge-1',
  userId: 7,
  email: 'jane@test.dev',
  purpose: OtpPurpose.EMAIL_VERIFICATION,
  codeHash: hashOtpCode(SECRET, 'challenge-1', '123456'),
  expiresAt: new Date(Date.now() + 600_000),
  attempts: 0,
  maxAttempts: 5,
  requestCount: 1,
  lastSentAt: new Date(),
  consumedAt: null,
  createdAt: new Date(),
  ...overrides,
});

const captureError = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as BadRequestException).getResponse();
  }
  throw new Error('expected the promise to reject');
};

interface Harness {
  service: EmailOtpService;
  txRepo: Record<string, jest.Mock>;
  challengeRepo: { count: jest.Mock; findOne: jest.Mock; manager: unknown };
  userRepo: { findOneBy: jest.Mock };
  emailService: { sendOtpEmail: jest.Mock };
  setChallenge: (challenge: unknown) => void;
}

const buildHarness = (): Harness => {
  const txRepo: Record<string, jest.Mock> = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    insert: jest.fn().mockResolvedValue({}),
    increment: jest.fn().mockResolvedValue({}),
    create: jest.fn((value: unknown) => value),
    createQueryBuilder: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn(),
    transaction: jest.fn(),
  };
  manager.getRepository.mockReturnValue(txRepo);
  manager.transaction.mockImplementation(
    (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  );

  const challengeRepo = {
    count: jest.fn(),
    findOne: jest.fn(),
    manager,
  };
  challengeRepo.count.mockResolvedValue(0);
  challengeRepo.findOne.mockResolvedValue(null);

  const userRepo = { findOneBy: jest.fn() };

  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      Promise.resolve(entity === User ? userRepo : challengeRepo),
    ),
  };

  const emailService = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };

  const service = new EmailOtpService(
    tenantManager as never,
    emailService as never,
    config as never,
  );

  const setChallenge = (challenge: unknown) => {
    txRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(challenge),
    });
  };

  return {
    service,
    txRepo,
    challengeRepo,
    userRepo,
    emailService,
    setChallenge,
  };
};

describe('EmailOtpService.request', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns generic success without sending for an unknown email', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(null);

    const result = await h.service.request({
      email: 'nobody@test.dev',
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      tenant: TENANT,
    });

    expect(result).toEqual({ success: true });
    expect(h.emailService.sendOtpEmail).not.toHaveBeenCalled();
    expect(h.txRepo.insert).not.toHaveBeenCalled();
  });

  it('consumes the prior active challenge and inserts + sends a new one', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.challengeRepo.findOne.mockResolvedValue(null);

    const result = await h.service.request({
      email: 'jane@test.dev',
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      tenant: TENANT,
    });

    expect(result).toEqual({ success: true });
    expect(h.txRepo.update).toHaveBeenCalledTimes(1);
    const updateArgs = h.txRepo.update.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { consumedAt: unknown },
    ];
    expect(updateArgs[0]).toMatchObject({
      userId: 7,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
    });
    expect(updateArgs[1].consumedAt).toBeInstanceOf(Date);
    expect(h.txRepo.insert).toHaveBeenCalledTimes(1);
    expect(h.emailService.sendOtpEmail).toHaveBeenCalledTimes(1);
    const sentCalls = h.emailService.sendOtpEmail.mock
      .calls as unknown as Array<
      [{ to: string; code: string; purpose: string }]
    >;
    const sent = sentCalls[0][0];
    expect(sent.to).toBe('jane@test.dev');
    expect(sent.code).toMatch(/^[0-9]{6}$/);
    expect(sent.purpose).toBe(OtpPurpose.EMAIL_VERIFICATION);
  });

  it('suppresses a resend inside the cooldown window', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.challengeRepo.findOne.mockResolvedValue(
      makeChallenge({ lastSentAt: new Date() }),
    );

    await h.service.request({
      email: 'jane@test.dev',
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      tenant: TENANT,
    });

    expect(h.txRepo.insert).not.toHaveBeenCalled();
    expect(h.emailService.sendOtpEmail).not.toHaveBeenCalled();
  });

  it('suppresses a request once the window cap is reached', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.challengeRepo.count.mockResolvedValue(otpConfig.maxRequests);

    await h.service.request({
      email: 'jane@test.dev',
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      tenant: TENANT,
    });

    expect(h.txRepo.insert).not.toHaveBeenCalled();
    expect(h.emailService.sendOtpEmail).not.toHaveBeenCalled();
  });
});

describe('EmailOtpService.verify', () => {
  beforeEach(() => jest.clearAllMocks());

  const verify = (h: Harness, code = '123456') =>
    h.service.verify({
      email: 'jane@test.dev',
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      code,
      tenant: TENANT,
    });

  it('consumes the matching challenge and returns challenge + user', async () => {
    const h = buildHarness();
    const user = makeUser();
    h.userRepo.findOneBy.mockResolvedValue(user);
    h.setChallenge(makeChallenge());

    const result = await verify(h);

    expect(result.user).toBe(user);
    expect(result.challenge.id).toBe('challenge-1');
    expect(h.txRepo.update).toHaveBeenCalledTimes(1);
    const consumeArgs = h.txRepo.update.mock.calls[0] as unknown as [
      { id: string },
      { consumedAt: unknown },
    ];
    expect(consumeArgs[0]).toEqual({ id: 'challenge-1' });
    expect(consumeArgs[1].consumedAt).toBeInstanceOf(Date);
  });

  it('increments attempts and rejects a wrong code', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.setChallenge(makeChallenge());

    const response = await captureError(verify(h, '000000'));

    expect(response).toMatchObject({ code: OtpErrorCode.INVALID });
    expect(h.txRepo.increment).toHaveBeenCalledWith(
      { id: 'challenge-1' },
      'attempts',
      1,
    );
  });

  it('rejects an expired challenge', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.setChallenge(makeChallenge({ expiresAt: new Date(Date.now() - 1000) }));

    const response = await captureError(verify(h));

    expect(response).toMatchObject({ code: OtpErrorCode.EXPIRED });
    expect(h.txRepo.update).not.toHaveBeenCalled();
  });

  it('rejects an already consumed challenge', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.setChallenge(makeChallenge({ consumedAt: new Date() }));

    const response = await captureError(verify(h));

    expect(response).toMatchObject({ code: OtpErrorCode.ALREADY_USED });
  });

  it('rejects once the attempts cap is reached', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.setChallenge(makeChallenge({ attempts: 5, maxAttempts: 5 }));

    const response = await captureError(verify(h));

    expect(response).toMatchObject({ code: OtpErrorCode.TOO_MANY_ATTEMPTS });
  });

  it('rejects when there is no challenge', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(makeUser());
    h.setChallenge(null);

    const response = await captureError(verify(h));

    expect(response).toMatchObject({ code: OtpErrorCode.INVALID });
  });

  it('rejects an unknown email', async () => {
    const h = buildHarness();
    h.userRepo.findOneBy.mockResolvedValue(null);

    const response = await captureError(verify(h));

    expect(response).toMatchObject({ code: OtpErrorCode.INVALID });
    expect(h.txRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
