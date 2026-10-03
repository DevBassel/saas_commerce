import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { RegisterStoreDto } from './dto/register-store.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { IENV, IJWT } from '../../common/config/env.interface';
import { JwtPayload } from './dto/jwt-payload.dto';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { randomUUID } from 'crypto';
import { compare } from 'bcrypt';
import { TenantService } from '../tenants/tenant.service';
import { TenantProvisionerService } from '../tenants/services/tenant-provisioner.service';
import { assertTenantActive } from '../tenants/utils/tenant-policy';
import { requireTenantContext } from '../tenants/utils/tenant-scope';
import { SubscriptionService } from '../subscriptions/services/subscription.service';
import { TenantIdentity, tenantRefFromPayload } from './tenant-ref.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<IENV>,
    private readonly tenantService: TenantService,
    private readonly provisioner: TenantProvisionerService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async register(userData: CreateUserDto) {
    const tenant = this.requireTenant();
    await this.userService.create(userData, RoleKey.CUSTOMER, tenant);
    return { success: true, msg: 'register success' };
  }

  async registerStore(userData: RegisterStoreDto) {
    const tenant = await this.tenantService.create({
      name: userData.storeName,
      slug: userData.storeSlug,
      subdomain: userData.subdomain,
    });

    await this.provisioner.provision(tenant);

    // Assign the free plan before creating the owner so the owner counts
    // against the plan's STORE_ADMINS limit and storage is plan-driven.
    await this.subscriptions.ensureFreeSubscription(tenant);

    const owner = await this.userService.create(
      {
        name: userData.name,
        email: userData.email,
        password: userData.password,
      },
      RoleKey.STORE_OWNER,
      tenant,
    );

    await this.tenantService.setOwnerUserId(tenant.id, owner.id);

    return this.returnUserCredential(owner, tenant);
  }

  async login(loginData: LoginUserDto) {
    const tenant = this.requireTenant();
    const user = await this.userService.findOne(
      { email: loginData.email },
      {},
      tenant,
    );
    if (!user) throw new NotFoundException();

    const check = await compare(loginData.password, user.password);
    if (!check) throw new UnauthorizedException('invalid credentials');

    return this.returnUserCredential(user, tenant);
  }

  async loginPlatform(loginData: LoginUserDto) {
    const user = await this.userService.findOnePublic(
      { email: loginData.email },
      { withRole: true },
    );
    if (!user) throw new NotFoundException();
    if (user.role?.key !== RoleKey.SUPER_ADMIN)
      throw new UnauthorizedException('not a platform administrator');

    const check = await compare(loginData.password, user.password);
    if (!check) throw new UnauthorizedException('invalid credentials');

    return this.returnUserCredential(user);
  }

  async refresh_user_credentials(refreshToken: string) {
    const { refreshSecret, issuer, audience } =
      this.config.getOrThrow<IJWT>('jwt');

    let verifyToken: JwtPayload;
    try {
      verifyToken = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
        issuer,
        audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!verifyToken) throw new UnauthorizedException();

    if (verifyToken.type != 'refresh')
      throw new UnauthorizedException('token not valid');

    const tenant = tenantRefFromPayload(verifyToken);

    if (tenant) {
      const registered = await this.tenantService.findBySchemaName(
        tenant.schemaName,
      );
      if (!registered || registered.id !== tenant.id)
        throw new UnauthorizedException('Invalid refresh token');
      assertTenantActive(registered);
    }

    const user = tenant
      ? await this.userService.findOne({ id: verifyToken.id }, {}, tenant)
      : await this.userService.findOnePublic({ id: verifyToken.id });
    if (!user) throw new NotFoundException();

    if (!verifyToken.jti || verifyToken.jti !== user.jti)
      throw new UnauthorizedException('Token revoked');

    return this.returnUserCredential(user, tenant);
  }

  async logout(userId: number, tenant?: TenantIdentity) {
    if (tenant) {
      await this.userService.updateSession(userId, null, tenant);
    } else {
      await this.userService.updateSessionPublic(userId, null);
    }
    return { success: true, msg: 'logout success' };
  }

  async returnUserCredential(user: User, tenant?: TenantIdentity) {
    const payload = {
      id: user.id,
      role: user.role?.key ?? RoleKey.CUSTOMER,
      tenantId: tenant?.id ?? null,
      tenantSchema: tenant?.schemaName ?? null,
    };
    const jti = randomUUID();
    const {
      accessSecret,
      refreshSecret,
      accessExpiresIn,
      refreshExpiresIn,
      issuer,
      audience,
    } = this.config.getOrThrow<IJWT>('jwt');

    const access_token = this.jwt.sign(
      {
        type: 'access',
        ...payload,
      },
      {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
        issuer,
        audience,
      },
    );

    const refresh_token = this.jwt.sign(
      {
        type: 'refresh',
        jti,
        ...payload,
      },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
        issuer,
        audience,
      },
    );

    if (tenant) {
      await this.userService.updateSession(user.id, jti, tenant);
    } else {
      await this.userService.updateSessionPublic(user.id, jti);
    }

    return { id: payload.id, access_token, refresh_token };
  }

  private requireTenant(): TenantIdentity {
    return requireTenantContext().tenant;
  }
}
