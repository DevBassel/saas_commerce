import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EnvSchema } from './common/config/env.schema';
import { ConfigEnv } from './common/config/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IDB, IENV, IJWT } from './common/config/env.interface';
import { AppLoggerModule } from './common/logger/logger.module';
import { TypeOrmDailyLogger } from './common/logger/typeorm-daily.logger';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: EnvSchema,
      load: [ConfigEnv],
    }),
    AppLoggerModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<IENV>) => {
        const { name, host, port, username, password, synchronize } =
          config.getOrThrow<IDB>('db');
        return {
          type: 'postgres',
          host,
          port,
          username,
          password: password,
          database: name,
          autoLoadEntities: true,
          synchronize: synchronize,
          logging: 'all',
          logger: new TypeOrmDailyLogger('all'),
          entities: [__dirname + '/**/*.entity.{js,ts}'],
        };
      },
    }),
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
})
export default class CoreModule {}
