import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { RegisterStoreDto } from './dto/register-store.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refreshtoken.dto';
import { Public } from './decorators/isPublic.decorator';
import { Platform } from './decorators/isPlatform.decorator';
import { Throttle } from '@nestjs/throttler';
import type { RequestWithUser } from './interfaces/RequestWithUser.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() registerData: CreateUserDto) {
    return this.authService.register(registerData);
  }

  @Platform()
  @Public()
  @Post('register-store')
  registerStore(@Body() registerData: RegisterStoreDto) {
    return this.authService.registerStore(registerData);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginData: LoginUserDto) {
    return this.authService.login(loginData);
  }

  @Public()
  @Platform()
  @Post('login/platform')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  loginPlatform(@Body() loginData: LoginUserDto) {
    return this.authService.loginPlatform(loginData);
  }

  @Public()
  @Platform()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() refreshData: RefreshTokenDto) {
    return this.authService.refresh_user_credentials(refreshData.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() request: RequestWithUser) {
    return this.authService.logout(request.user.id, request.tenant);
  }

  @Platform()
  @Post('logout/platform')
  @HttpCode(HttpStatus.OK)
  logoutPlatform(@Req() request: RequestWithUser) {
    return this.authService.logout(request.user.id);
  }
}
