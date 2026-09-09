import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../dto/jwt-payload.dto';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class JwtGuard implements CanActivate {
  private logger = new Logger(JwtGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = this.jwt.verify<JwtPayload>(token);

      if (payload.type !== 'access') throw new UnauthorizedException();
      const user = await this.userService.findOne({ id: payload.id });
      if (!user) throw new NotFoundException('User not found');

      request.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      this.logger.error(error);
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }
}
