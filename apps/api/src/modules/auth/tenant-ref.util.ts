import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from './dto/jwt-payload.dto';

export interface TenantIdentity {
  id: number;
  schemaName: string;
}

export const tenantRefFromPayload = (
  payload: JwtPayload,
): TenantIdentity | undefined => {
  if (payload.tenantId != null && payload.tenantSchema != null) {
    return { id: payload.tenantId, schemaName: payload.tenantSchema };
  }
  if (payload.tenantId == null && payload.tenantSchema == null) {
    return undefined;
  }

  throw new ForbiddenException('Token carries an incomplete tenant claim');
};
