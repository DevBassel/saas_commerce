import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './rbac.service';
import { RbacSeedService } from './rbac.seed.service';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '../users/entities/user.entity';
import { TenantModule } from '../tenants/tenant.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, User]), TenantModule],
  controllers: [RolesController, PermissionsController],
  providers: [RbacService, RbacSeedService],
  exports: [RbacService],
})
export class RbacModule {}
