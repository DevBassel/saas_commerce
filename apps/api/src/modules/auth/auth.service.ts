import {
  Injectable,
  Logger,
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
import { IENV, IJWT, IOtp } from '../../common/config/env.interface';
import { JwtPayload } from './dto/jwt-payload.dto';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { randomUUID } from 'crypto';
import { compare, hash } from 'bcrypt';
import { TenantService } from '../tenants/tenant.service';
import { TenantProvisionerService } from '../tenants/services/tenant-provisioner.service';
import { assertTenantActive } from '../tenants/utils/tenant-policy';
import { requireTenantContext } from '../tenants/utils/tenant-scope';
import { SubscriptionService } from '../subscriptions/services/subscription.service';
import { TenantIdentity, tenantRefFromPayload } from './tenant-ref.util';
import { EmailOtpService } from '../email-otp/email-otp.service';
import { OtpPurpose } from '../email-otp/constants/otp-purpose.enum';
import { OtpErrorCode, otpError } from '../email-otp/constants/otp.constants';
import { RequestOtpDto } from '../email-otp/dto/request-otp.dto';
import { VerifyOtpDto } from '../email-otp/dto/verify-otp.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<IENV>,
    private readonly tenantService: TenantService,
    private readonly provisioner: TenantProvisionerService,
    private readonly subscriptions: SubscriptionService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  async register(userData: CreateUserDto) {
    const tenant = this.requireTenant();
    await this.userService.create(userData, RoleKey.CUSTOMER, tenant);

    await this.dispatchVerificationOtp(userData.email, tenant);

    return { success: true, msg: 'register success' };
  }

  private async dispatchVerificationOtp(
    email: string,
    tenant: TenantIdentity,
  ): Promise<void> {
    try {
      await this.emailOtp.request({
        email,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        tenant,
      });
    } catch {
      this.logger.error(
        `Failed to dispatch the registration verification OTP for ${email}`,
      );
    }
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

    const { requireEmailVerified } = this.config.getOrThrow<IOtp>('otp');
    if (requireEmailVerified && !user.emailVerified) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email is not verified',
      });
    }

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

    return {
      id: payload.id,
      email: user.email,
      verified: user.emailVerified,
      access_token,
      refresh_token,
    };
  }

  async requestEmailOtp(dto: RequestOtpDto) {
    const tenant = this.requireTenant();
    return this.emailOtp.request({
      email: dto.email,
      purpose: dto.purpose,
      tenant,
    });
  }

  async verifyEmailOtp(dto: VerifyOtpDto) {
    const tenant = this.requireTenant();

    if (dto.purpose === OtpPurpose.PASSWORD_RESET)
      throw otpError(OtpErrorCode.PURPOSE_REQUIRES_CONFIRM);
    if (dto.purpose === OtpPurpose.SENSITIVE_ACTION)
      throw otpError(OtpErrorCode.PURPOSE_NOT_SUPPORTED);

    const { user } = await this.emailOtp.verify({
      email: dto.email,
      purpose: dto.purpose,
      code: dto.code,
      tenant,
    });

    if (dto.purpose === OtpPurpose.EMAIL_VERIFICATION) {
      await this.userService.markEmailVerified(user.id, tenant);
      return { verified: true };
    }

    // LOGIN_MFA: the challenge is consumed; issue the standard credentials.
    return this.returnUserCredential(user, tenant);
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const tenant = this.requireTenant();

    const { user } = await this.emailOtp.verify({
      email: dto.email,
      purpose: OtpPurpose.PASSWORD_RESET,
      code: dto.code,
      tenant,
    });

    const password = await hash(
      dto.newPassword,
      this.config.getOrThrow<IENV['bcrypt']>('bcrypt').rounds,
    );
    await this.userService.updatePassword(user.id, password, tenant);

    return { success: true };
  }

  private requireTenant(): TenantIdentity {
    return requireTenantContext().tenant;
  }
}
