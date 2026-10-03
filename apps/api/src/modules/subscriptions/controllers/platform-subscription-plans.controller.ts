import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Platform } from '../../auth/decorators/isPlatform.decorator';
import { Roles } from '../../auth/decorators/role.decorator';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { ListSubscriptionPlansQueryDto } from '../dto/list-subscription-plans.query.dto';

@Platform()
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform/subscription-plans')
export class PlatformSubscriptionPlansController {
  constructor(private readonly plans: SubscriptionPlansService) {}

  @Get()
  findAll(@Query() query: ListSubscriptionPlansQueryDto) {
    return this.plans.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plans.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.plans.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.plans.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plans.remove(id);
  }
}
