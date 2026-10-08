import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailTransport } from './email-transport.interface';

/**
 * Development transport. It records the recipient and subject only and never
 * writes the OTP (which lives in the message body).
 */
@Injectable()
export class LogEmailTransport implements EmailTransport {
  private readonly logger = new Logger('EmailTransport');

  send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `email queued to=${message.to} subject="${message.subject}"`,
      message,
    );
    return Promise.resolve();
  }
}
