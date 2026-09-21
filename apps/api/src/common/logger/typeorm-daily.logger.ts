import { mkdirSync } from 'fs';
import { join } from 'path';
import { createStream, RotatingFileStream } from 'rotating-file-stream';
import {
  AbstractLogger,
  LogLevel,
  LogMessage,
  LoggerOptions,
  QueryRunner,
} from 'typeorm';

export class TypeOrmDailyLogger extends AbstractLogger {
  private readonly stream: RotatingFileStream;

  constructor(options: LoggerOptions) {
    super(options);

    const logDirectory = join(process.cwd(), 'logs/typeorm');
    mkdirSync(logDirectory, { recursive: true });

    this.stream = createStream(
      () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `typeorm-${year}-${month}-${day}.log`;
      },
      {
        path: logDirectory,
        interval: '1d',
        intervalBoundary: true,
      },
    );
  }

  protected writeLog(
    level: LogLevel,
    logMessage: LogMessage | string | number | (LogMessage | string | number)[],
    queryRunner?: QueryRunner,
  ): void {
    const messages = this.prepareLogMessages(
      logMessage,
      {
        highlightSql: false,
        addColonToPrefix: false,
      },
      queryRunner,
    );

    for (const message of messages) {
      const type = message.type ?? level;
      const timestamp = new Date().toISOString();
      this.stream.write(
        `[${timestamp}] [${type.toUpperCase()}]: ${message.message}\n`,
      );
    }
  }
}
