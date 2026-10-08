import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmail, IENV } from 'src/common/config/env.interface';
import { EmailService } from './email.service';
import {
  EMAIL_TRANSPORT,
  EmailTransport,
} from './transports/email-transport.interface';
import { LogEmailTransport } from './transports/log-email.transport';
import { MemoryEmailTransport } from './transports/memory-email.transport';
import { SmtpEmailTransport } from './transports/smtp-email.transport';

@Module({
  providers: [
    EmailService,
    {
      provide: EMAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<IENV>): EmailTransport => {
        const { provider } = config.getOrThrow<IEmail>('email');
        switch (provider) {
          case 'log':
            return new LogEmailTransport();
          case 'memory':
            return new MemoryEmailTransport();
          case 'smtp':
          default:
            return new SmtpEmailTransport(config);
        }
      },
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
