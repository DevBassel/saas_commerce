import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, User])],
  controllers: [RolesController, PermissionsController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
