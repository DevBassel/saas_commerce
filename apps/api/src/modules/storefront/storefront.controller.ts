import { Controller, Get, Req } from '@nestjs/common';
import { Public } from '../auth/decorators/isPublic.decorator';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

@Public()
@Controller('store')
export class StorefrontController {
  @Get('info')
  getInfo(@Req() req: RequestWithUser) {
    const tenant = req.tenant!;
    return {
      name: tenant.name,
      slug: tenant.slug,
      currency: tenant.currency,
    };
  }
}
