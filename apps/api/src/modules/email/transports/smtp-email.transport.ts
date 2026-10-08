import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { IEmail, IENV } from 'src/common/config/env.interface';
import { EmailMessage, EmailTransport } from './email-transport.interface';

/** Production SMTP transport. Message bodies are never logged. */
@Injectable()
export class SmtpEmailTransport implements EmailTransport {
  private readonly logger = new Logger('EmailTransport');
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService<IENV>) {
    const { fromAddress, fromName, smtp } = config.getOrThrow<IEmail>('email');
    this.from = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth:
        smtp.user && smtp.password
          ? { user: smtp.user, pass: smtp.password }
          : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      this.logger.error(
        `email delivery failed to=${message.to}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw error;
    }
  }
}
