import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { createStream } from 'rotating-file-stream';
import { IENV, Ilog } from '../config/env.interface';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<IENV>) => {
        const { level } = config.getOrThrow<Ilog>('log');

        const logDirectory = join(process.cwd(), 'logs/app');
        mkdirSync(logDirectory, { recursive: true });

        const logStream = createStream(
          () => {
            const date = new Date(Date.now());
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `app-${year}-${month}-${day}.log`;
          },
          {
            path: logDirectory,
            interval: '1d',
            intervalBoundary: true,
          },
        );

        return {
          pinoHttp: [
            {
              level,
              redact: ['req.headers.authorization', 'req.headers.cookie'],
            },
            logStream,
          ],
        };
      },
    }),
  ],
})
export class AppLoggerModule {}
