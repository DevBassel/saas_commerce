import { EntityManager } from 'typeorm';
import { CouponsService } from '../coupons.service';
import { Coupon } from '../entities/coupon.entity';
import { CouponRedemption } from '../entities/coupon-redemption.entity';
import { CartService } from '../../cart/cart.service';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import { DiscountType } from '../constants/discount-type.enum';

export const TENANT = { schemaName: 'tenant_test' };
export const NOW = new Date('2026-01-01T00:00:00.000Z');

export const couponEntity = (overrides: Record<string, unknown> = {}): Coupon =>
  ({
    id: 1,
    code: 'SAVE10',
    description: '10% off',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    usageLimit: null,
    perUserLimit: null,
    usageCount: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }) as unknown as Coupon;

export const createDto = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  code: 'save10',
  discountType: DiscountType.PERCENTAGE,
  discountValue: 10,
  ...overrides,
});

export const buildCouponMocks = () => {
  const couponQb = {
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const couponRepo = {
    findOneBy: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: Record<string, unknown>) => ({
      id: 1,
      usageCount: 0,
      createdAt: NOW,
      updatedAt: NOW,
      ...data,
    })),
    update: jest.fn(),
    delete: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(() => couponQb),
  };
  const redemptionRepo = {
    count: jest.fn(),
    create: jest.fn((data: unknown) => data),
    insert: jest.fn(),
    delete: jest.fn(),
  };

  const entityManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === CouponRedemption) return redemptionRepo;
      return couponRepo;
    }),
  };

  const cartMocks = {
    getCart: jest.fn().mockResolvedValue({ subtotal: 0 }),
  };

  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      Promise.resolve(
        entity === CouponRedemption ? redemptionRepo : couponRepo,
      ),
    ),
  } as unknown as TenantManagerService;

  const service = new CouponsService(
    tenantManager,
    cartMocks as unknown as CartService,
  );

  return {
    service,
    tenantManager,
    cartMocks,
    couponRepo,
    redemptionRepo,
    couponQb,
    entityManager: entityManager as unknown as EntityManager,
  };
};
