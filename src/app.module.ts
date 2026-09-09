import { Module } from '@nestjs/common';
import CoreModule from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { APP_GUARD } from '@nestjs/core';
import { PermissionGuard } from './modules/auth/guards/permission.guard';
import { JwtGuard } from './modules/auth/guards/jwt.guard';

@Module({
  imports: [CoreModule, AuthModule, UsersModule, RbacModule],
  providers: [
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
export class AppModule {}
