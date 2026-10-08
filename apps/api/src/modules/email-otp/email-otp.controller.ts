import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service';
import { Public } from '../auth/decorators/isPublic.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

/**
 * Tenant-scoped OTP routes. They run before authentication (`@Public`) but are
 * not `@Platform`, so `TenantGuard` still requires a resolvable tenant: clients
 * must send `x-tenant-slug` / `x-tenant-id` or use the tenant subdomain.
 */
@Controller('auth/email-otp')
export class EmailOtpController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  request(@Body() dto: RequestOtpDto) {
    return this.authService.requestEmailOtp(dto);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verify(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyEmailOtp(dto);
  }
}
