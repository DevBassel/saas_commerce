import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import CoreModule from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { TenantModule } from './modules/tenants/tenant.module';
import { PlatformModule } from './modules/platform/platform.module';
import { APP_GUARD } from '@nestjs/core';
import { PermissionGuard } from './modules/auth/guards/permission.guard';
import { JwtGuard } from './modules/auth/guards/jwt.guard';
import { TenantGuard } from './modules/auth/guards/tenant.guard';
import { TenantMiddleware } from './modules/auth/tenant.middleware';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    UsersModule,
    RbacModule,
    TenantModule,
    PlatformModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
