import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AddressPermissionKey } from './constants/address-permissions.enum';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @Permissions([AddressPermissionKey.READ])
  findAll(@Req() request: RequestWithUser) {
    return this.addressesService.findAll(request.user.id);
  }

  @Get(':id')
  @Permissions([AddressPermissionKey.READ])
  findOne(
    @Req() request: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.addressesService.findOne(request.user.id, id);
  }

  @Post()
  @Permissions([AddressPermissionKey.CREATE])
  create(@Req() request: RequestWithUser, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(request.user.id, dto);
  }

  @Patch(':id/default')
  @Permissions([AddressPermissionKey.UPDATE])
  setDefault(
    @Req() request: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.addressesService.setDefault(request.user.id, id);
  }

  @Patch(':id')
  @Permissions([AddressPermissionKey.UPDATE])
  update(
    @Req() request: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(request.user.id, id, dto);
  }

  @Delete(':id')
  @Permissions([AddressPermissionKey.DELETE])
  remove(
    @Req() request: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.addressesService.remove(request.user.id, id);
  }
}
