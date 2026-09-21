import { Reflector } from '@nestjs/core';
import { RoleKey } from 'src/common/constants/RoleKey.enum';

export const Roles = Reflector.createDecorator<RoleKey[]>();
