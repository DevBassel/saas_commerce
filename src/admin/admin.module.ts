import { ConfigService } from '@nestjs/config';
import { DynamicModule } from '@nestjs/common';
import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../modules/rbac/entities/role.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { RoleKey } from '../common/constants/RoleKey.enum';
import { IADMIN, IENV } from '../common/config/env.interface';

const buildAuthenticate = (dataSource: DataSource) => {
  return async (email: string, password: string) => {
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { email }, relations: { role: true } });

    if (!user?.role || user.role.key !== RoleKey.SUPER_ADMIN) return null;

    const match = await bcrypt.compare(password, user.password);
    return match ? { email: user.email, title: 'Super Admin' } : null;
  };
};

const adminJsOptions = (config: ConfigService<IENV>, dataSource: DataSource) => {
  const admin = config.getOrThrow<IADMIN>('admin');
  return {
    adminJsOptions: {
      rootPath: admin.rootPath,
      branding: { companyName: 'SaaS Store' },
      resources: [
        {
          resource: User,
          options: {
            properties: {
              password: { isVisible: false },
              jti: { isVisible: false },
            },
          },
        },
        { resource: Role, options: {} },
        { resource: Permission, options: {} },
        { resource: Tenant, options: {} },
      ],
    },
    auth: {
      authenticate: buildAuthenticate(dataSource),
      cookieName: admin.cookieName,
      cookiePassword: admin.cookiePassword,
    },
    sessionOptions: {
      resave: true,
      saveUninitialized: true,
      secret: admin.sessionSecret,
    },
  };
};

export const AdminJsModule: Promise<DynamicModule> =
  import('@adminjs/nestjs').then(async ({ AdminModule }) => {
    const [{ Database, Resource }, { default: AdminJS }] = await Promise.all([
      import('@adminjs/typeorm'),
      import('adminjs'),
    ]);
    AdminJS.registerAdapter({ Database, Resource });

    return AdminModule.createAdminAsync({
      inject: [ConfigService, DataSource],
      useFactory: (config: ConfigService<IENV>, dataSource: DataSource) =>
        adminJsOptions(config, dataSource),
    });
  });
