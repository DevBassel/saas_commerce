import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EnvSchema } from './common/config/env.schema';
import { ConfigEnv } from './common/config/config';
import { IENV, IJWT, IThrottling } from './common/config/env.interface';
import { AppLoggerModule } from './common/logger/logger.module';
import { R2Module } from './common/storage/r2.module';
import { HealthController } from './common/health/health.controller';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from './common/cache/cache.module';
import DatabaseModule from './database/Database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: EnvSchema,
      load: [ConfigEnv],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: (config: ConfigService<IENV>) => {
        const { ttl, limit } = config.getOrThrow<IThrottling>('throttling');
        return {
          throttlers: [
            {
              ttl: seconds(ttl),
              limit,
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
    AppLoggerModule,
    R2Module,
    CacheModule,
    DatabaseModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: (config: ConfigService<IENV>) => {
        const { accessExpiresIn, accessSecret } =
          config.getOrThrow<IJWT>('jwt');
        return {
          secret: accessSecret,
          signOptions: {
            expiresIn: accessExpiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [HealthController],
})
export default class CoreModule {}
