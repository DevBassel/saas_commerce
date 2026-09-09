import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { Public } from './decorators/isPublic.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerData: CreateUserDto) {
    return this.authService.register(registerData);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginData: LoginUserDto) {
    console.log('login');
    return this.authService.login(loginData);
  }
}
