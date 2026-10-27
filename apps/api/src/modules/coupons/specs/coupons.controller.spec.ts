import { Test } from '@nestjs/testing';
import { CouponsController } from '../coupons.controller';
import { CouponsService } from '../coupons.service';
import { ValidateCouponDto } from '../dto/validate-coupon.dto';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { UpdateCouponStatusDto } from '../dto/update-coupon-status.dto';
import { ListCouponsQueryDto } from '../dto/list-coupons.query.dto';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { CouponPermissionKey } from '../constants/coupon-permissions.enum';
import { DiscountType } from '../constants/discount-type.enum';

const mockCouponsService = {
  validate: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  setStatus: jest.fn(),
  remove: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: {
      id: 1,
      email: 'test@test.dev',
      permissions: [
        CouponPermissionKey.VALIDATE,
        CouponPermissionKey.CREATE,
        CouponPermissionKey.READ,
        CouponPermissionKey.UPDATE,
        CouponPermissionKey.DELETE,
      ],
    },
    tenant: { id: 1, schemaName: 'tenant_test' },
    ...overrides,
  }) as RequestWithUser;

describe('CouponsController', () => {
  let controller: CouponsController;
  let couponsService: typeof mockCouponsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [{ provide: CouponsService, useValue: mockCouponsService }],
    }).compile();

    controller = moduleRef.get(CouponsController);
    couponsService = moduleRef.get(CouponsService);
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('delegates to CouponsService.validate with code and user id', async () => {
      const req = makeRequest();
      const dto: ValidateCouponDto = { code: 'SAVE10' };
      const expected = { discountAmount: 10, code: 'SAVE10' };
      couponsService.validate.mockResolvedValue(expected);

      const result = await controller.validate(req, dto);

      expect(couponsService.validate).toHaveBeenCalledWith(
        dto.code,
        req.user.id,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to CouponsService.create with dto', async () => {
      const dto: CreateCouponDto = {
        code: 'SAVE10',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
      };
      const expected = {
        id: 1,
        code: 'SAVE10',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
      };
      couponsService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(couponsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('delegates to CouponsService.findAll with query', async () => {
      const query: ListCouponsQueryDto = { page: 1, limit: 10 };
      const expected = {
        data: [{ id: 1, code: 'SAVE10' }],
        total: 1,
        page: 1,
        limit: 10,
      };
      couponsService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(couponsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('delegates to CouponsService.findOne with id', async () => {
      const expected = {
        id: 1,
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
      };
      couponsService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(1);

      expect(couponsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('setStatus', () => {
    it('delegates to CouponsService.setStatus with id and dto', async () => {
      const dto: UpdateCouponStatusDto = { isActive: false };
      const expected = { id: 1, isActive: false };
      couponsService.setStatus.mockResolvedValue(expected);

      const result = await controller.setStatus(1, dto);

      expect(couponsService.setStatus).toHaveBeenCalledWith(1, false);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to CouponsService.update with id and dto', async () => {
      const dto: UpdateCouponDto = { description: 'Updated' };
      const expected = { id: 1, description: 'Updated' };
      couponsService.update.mockResolvedValue(expected);

      const result = await controller.update(1, dto);

      expect(couponsService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('delegates to CouponsService.remove with id', async () => {
      const expected = { deleted: true };
      couponsService.remove.mockResolvedValue(expected);

      const result = await controller.remove(1);

      expect(couponsService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });
});
