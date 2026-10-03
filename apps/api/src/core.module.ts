import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EnvSchema } from './common/config/env.schema';
import { ConfigEnv } from './common/config/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IENV, IJWT, IThrottling } from './common/config/env.interface';
import { AppLoggerModule } from './common/logger/logger.module';
import { R2Module } from './common/storage/r2.module';
import { HealthController } from './common/health/health.controller';
import { buildDataSourceOptions } from './common/config/data-source.factory';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { User } from './modules/users/entities/user.entity';
import { Role } from './modules/rbac/entities/role.entity';
import { Permission } from './modules/rbac/entities/permission.entity';
import { CurrencyChangeRequest } from './modules/currency-requests/entities/currency-change-request.entity';
import { SubscriptionPlan } from './modules/subscriptions/entities/subscription-plan.entity';
import { SubscriptionPlanLimit } from './modules/subscriptions/entities/subscription-plan-limit.entity';
import { SubscriptionPlanFeature } from './modules/subscriptions/entities/subscription-plan-feature.entity';
import { Subscription } from './modules/subscriptions/entities/subscription.entity';
import { TenantUsageCounter } from './modules/subscriptions/entities/tenant-usage-counter.entity';
import { seconds, ThrottlerModule } from '@nestjs/throttler';

// Public schema entities only. Tenant-scoped entities live in
// tenant-entities.ts and must never be registered here.
const PUBLIC_ENTITIES = [
  Tenant,
  User,
  Role,
  Permission,
  CurrencyChangeRequest,
  SubscriptionPlan,
  SubscriptionPlanLimit,
  SubscriptionPlanFeature,
  Subscription,
  TenantUsageCounter,
];

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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<IENV>) => {
        return {
          ...buildDataSourceOptions(config),
          autoLoadEntities: true,
          entities: PUBLIC_ENTITIES,
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
  controllers: [HealthController],
})
export default class CoreModule {}
