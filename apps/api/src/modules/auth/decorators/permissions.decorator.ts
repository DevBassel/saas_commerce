import { Reflector } from '@nestjs/core';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';

export const Permissions = Reflector.createDecorator<PermissionKey[]>();
