import { Module } from '@nestjs/common';
import CoreModule from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { RoleGuard } from './modules/auth/guards/role.guard';
import { JwtGuard } from './modules/auth/guards/jwt.guard';

@Module({
  imports: [CoreModule, AuthModule, UsersModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}
