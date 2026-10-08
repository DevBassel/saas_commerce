import { Injectable } from '@nestjs/common';
import { EmailMessage, EmailTransport } from './email-transport.interface';

/** Test transport that keeps every sent message in memory. */
@Injectable()
export class MemoryEmailTransport implements EmailTransport {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  clear(): void {
    this.sent.length = 0;
  }
}
