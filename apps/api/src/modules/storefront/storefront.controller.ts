import { Controller, Get, Req } from '@nestjs/common';
import { Public } from '../auth/decorators/isPublic.decorator';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { CategoriesService } from '../categories/categories.service';

@Public()
@Controller('store')
export class StorefrontController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('info')
  getInfo(@Req() req: RequestWithUser) {
    const tenant = req.tenant!;
    return {
      name: tenant.name,
      slug: tenant.slug,
      currency: tenant.currency,
    };
  }

  @Get('categories')
  getCategories() {
    return this.categoriesService.findStorefrontOptions();
  }
}
