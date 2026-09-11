import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EnvSchema } from './common/config/env.schema';
import { ConfigEnv } from './common/config/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IENV, IJWT } from './common/config/env.interface';
import { AppLoggerModule } from './common/logger/logger.module';
import { buildDataSourceOptions } from './common/config/data-source.factory';
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
        return {
          ...buildDataSourceOptions(config),
          autoLoadEntities: true,
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
