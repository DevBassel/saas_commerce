import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { LogEmailTransport } from './transports/log-email.transport';
import { MemoryEmailTransport } from './transports/memory-email.transport';
import { buildOtpEmail } from './templates/otp-email.template';

const buildConfig = (appName = 'saas_store', fromName = 'Acme Store') =>
  ({
    getOrThrow: jest.fn((key: string) => {
      if (key === 'email')
        return {
          provider: 'memory',
          fromAddress: 'no-reply@acme.dev',
          fromName,
        };
      if (key === 'app') return { name: appName };
      throw new Error(`unexpected config key ${key}`);
    }),
  }) as never;

describe('EmailService', () => {
  it('sends a message containing the code, expiry and store name', async () => {
    const transport = new MemoryEmailTransport();
    const service = new EmailService(transport, buildConfig());

    await service.sendOtpEmail({
      to: 'jane@test.dev',
      code: '135790',
      purpose: 'EMAIL_VERIFICATION',
      expiresInSeconds: 600,
      storeName: 'Nike Store',
    });

    expect(transport.sent).toHaveLength(1);
    const message = transport.sent[0];
    expect(message.to).toBe('jane@test.dev');
    expect(message.subject).toContain('Nike Store');
    expect(message.subject).not.toContain('135790');
    expect(message.text).toContain('135790');
    expect(message.html).toContain('135790');
    expect(message.text).toContain('10 minutes');
  });

  it('falls back to the configured from name when no store name is given', async () => {
    const transport = new MemoryEmailTransport();
    const service = new EmailService(transport, buildConfig());

    await service.sendOtpEmail({
      to: 'jane@test.dev',
      code: '111111',
      purpose: 'PASSWORD_RESET',
      expiresInSeconds: 600,
    });

    expect(transport.sent[0].subject).toContain('Acme Store');
  });

  it('falls back to APP_NAME when no from name is configured', async () => {
    const transport = new MemoryEmailTransport();
    const service = new EmailService(transport, buildConfig('saas_store', ''));

    await service.sendOtpEmail({
      to: 'jane@test.dev',
      code: '222222',
      purpose: 'LOGIN_MFA',
      expiresInSeconds: 600,
    });

    expect(transport.sent[0].subject).toContain('saas_store');
  });
});

describe('LogEmailTransport', () => {
  it('logs recipient and subject but never the code', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const template = buildOtpEmail({
      code: '987654',
      purpose: 'EMAIL_VERIFICATION',
      expiresInSeconds: 600,
      displayName: 'Acme Store',
    });

    await new LogEmailTransport().send({
      to: 'jane@test.dev',
      ...template,
    });

    const logged = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain('jane@test.dev');
    expect(logged).not.toContain('987654');
    logSpy.mockRestore();
  });
});

describe('buildOtpEmail', () => {
  it('labels the purpose in the subject', () => {
    const content = buildOtpEmail({
      code: '000000',
      purpose: 'PASSWORD_RESET',
      expiresInSeconds: 600,
      displayName: 'Acme Store',
    });
    expect(content.subject.toLowerCase()).toContain('reset your password');
  });
});
