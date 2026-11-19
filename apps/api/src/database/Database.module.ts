import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IENV } from 'src/common/config/env.interface';
import { buildPlatformDataSourceOptions } from './data-source-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<IENV>) => {
        return {
          ...buildPlatformDataSourceOptions(config),
          autoLoadEntities: false,
        };
      },
    }),
  ],
})
export default class DatabaseModule {}
