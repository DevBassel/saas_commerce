import { Reflector } from '@nestjs/core';
import { RolesType } from 'src/common/constants/Roles.enum';

export const Roles = Reflector.createDecorator<RolesType[]>();
