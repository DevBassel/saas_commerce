import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAPP, IEmail, IENV } from 'src/common/config/env.interface';
import { buildOtpEmail } from './templates/otp-email.template';
import { EMAIL_TRANSPORT } from './transports/email-transport.interface';
import type { EmailTransport } from './transports/email-transport.interface';

export interface SendOtpEmailParams {
  to: string;
  code: string;
  purpose: string;
  expiresInSeconds: number;
  storeName?: string;
}

/**
 * The single delivery seam for the API. Callers depend on this service; the
 * provider-specific code lives behind {@link EmailTransport}.
 */
@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    private readonly config: ConfigService<IENV>,
  ) {}

  async sendOtpEmail(params: SendOtpEmailParams): Promise<void> {
    const { fromName } = this.config.getOrThrow<IEmail>('email');
    const { name } = this.config.getOrThrow<IAPP>('app');
    const displayName = params.storeName?.trim() || fromName || name;

    const content = buildOtpEmail({
      code: params.code,
      purpose: params.purpose,
      expiresInSeconds: params.expiresInSeconds,
      displayName,
    });

    await this.transport.send({ to: params.to, ...content });
  }
}
