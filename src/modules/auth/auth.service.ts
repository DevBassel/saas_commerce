import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { IENV, IJWT } from '../../common/config/env.interface';
import { JwtPayload } from './dto/jwt-payload.dto';
import { randomUUID } from 'crypto';
import { compare } from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<IENV>,
  ) {}
  register(userData: CreateUserDto) {
    return this.userService.create(userData);
  }

  async login(loginData: LoginUserDto) {
    const user = await this.userService.findOne({ email: loginData.email });
    if (!user) throw new NotFoundException();

    const check = await compare(loginData.password, user.password);
    if (!check) throw new UnauthorizedException('invalid credentials');

    return this.returnUserCredential(user);
  }

  async refresh_user_credentials(refreshToken: string) {
    const verifyToken: JwtPayload = this.jwt.verify(refreshToken);
    if (!verifyToken) throw new UnauthorizedException();

    if (verifyToken.type != 'refresh')
      throw new UnauthorizedException('token not valid');

    const user = await this.userService.findOne({ id: verifyToken.id });
    if (!user) throw new NotFoundException();

    return this.returnUserCredential(user);
  }

  async returnUserCredential(user: User) {
    const payload = {
      id: user.id,
      role: user.role,
    };
    const jti = randomUUID();
    const { accessExpiresIn, refreshExpiresIn } =
      this.config.getOrThrow<IJWT>('jwt');

    await this.userService.update(user.id, { jti });
    return {
      access_token: this.jwt.sign(
        {
          type: 'access',
          ...payload,
        },
        {
          expiresIn: accessExpiresIn,
        },
      ),

      refresh_token: this.jwt.sign(
        {
          type: 'refresh',
          jti,
          ...payload,
        },
        {
          expiresIn: refreshExpiresIn,
        },
      ),
    };
  }

  validateToken(token: string) {
    return this.jwt.verify<JwtPayload>(token);
  }
}
