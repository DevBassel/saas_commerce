import { Test } from '@nestjs/testing';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { ManageOrderService } from '../manage-order.service';
import { CheckoutDto } from '../dto/checkout.dto';
import { ListOrdersQueryDto } from '../dto/list-orders.query.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { OrderPermissionKey } from '../constants/order-permissions.enum';
import { OrderStatus } from '../constants/order-status.enum';

const mockOrdersService = {
  checkout: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  cancel: jest.fn(),
  requestReturn: jest.fn(),
};

const mockManageOrderService = {
  updateStatus: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: {
      id: 1,
      email: 'test@test.dev',
      role: { key: 'CUSTOMER' },
      permissions: [
        OrderPermissionKey.CREATE,
        OrderPermissionKey.READ,
        OrderPermissionKey.CANCEL,
        OrderPermissionKey.RETURN,
      ],
    },
    tenant: { id: 1, schemaName: 'tenant_test' },
    ...overrides,
  }) as RequestWithUser;

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: typeof mockOrdersService;
  let manageOrderService: typeof mockManageOrderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: ManageOrderService, useValue: mockManageOrderService },
      ],
    }).compile();

    controller = moduleRef.get(OrdersController);
    ordersService = moduleRef.get(OrdersService);
    manageOrderService = moduleRef.get(ManageOrderService);
    jest.clearAllMocks();
  });

  describe('checkout', () => {
    it('delegates to OrdersService.checkout with user id and dto', async () => {
      const req = makeRequest();
      const dto: CheckoutDto = { addressId: 5 };
      const expected = { id: 1, orderNumber: 'ORD-123', total: 100 };
      ordersService.checkout.mockResolvedValue(expected);

      const result = await controller.checkout(req, dto);

      expect(ordersService.checkout).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });

    it('uses empty dto when not provided', async () => {
      const req = makeRequest();
      ordersService.checkout.mockResolvedValue({ id: 1 } as any);

      await controller.checkout(req);

      expect(ordersService.checkout).toHaveBeenCalledWith(1, {});
    });
  });

  describe('findAll', () => {
    it('delegates to OrdersService.findAll with user and query', async () => {
      const req = makeRequest();
      const query: ListOrdersQueryDto = { page: 1, limit: 10 };
      const expected = { data: [{ id: 1 }], total: 1, page: 1, limit: 10 };
      ordersService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(req, query);

      expect(ordersService.findAll).toHaveBeenCalledWith(req.user, query);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('delegates to OrdersService.findOne with id and user', async () => {
      const req = makeRequest();
      const expected = { id: 1, orderNumber: 'ORD-123' };
      ordersService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(req, 1);

      expect(ordersService.findOne).toHaveBeenCalledWith(1, req.user);
      expect(result).toEqual(expected);
    });
  });

  describe('cancel', () => {
    it('delegates to OrdersService.cancel with id and user', async () => {
      const req = makeRequest();
      const expected = { id: 1, status: 'CANCELLED' };
      ordersService.cancel.mockResolvedValue(expected);

      const result = await controller.cancel(req, 1);

      expect(ordersService.cancel).toHaveBeenCalledWith(1, req.user);
      expect(result).toEqual(expected);
    });
  });

  describe('updateStatus', () => {
    it('delegates to ManageOrderService.updateStatus with id and dto', async () => {
      const dto: UpdateOrderStatusDto = { status: OrderStatus.PROCESSING };
      const expected = { id: 1, status: OrderStatus.PROCESSING };
      manageOrderService.updateStatus.mockResolvedValue(expected);

      const result = await controller.updateStatus(1, dto);

      expect(manageOrderService.updateStatus).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('requestReturn', () => {
    it('delegates to OrdersService.requestReturn with id and user', async () => {
      const req = makeRequest();
      const expected = { id: 1, status: 'RETURN_REQUESTED' };
      ordersService.requestReturn.mockResolvedValue(expected);

      const result = await controller.requestReturn(req, 1);

      expect(ordersService.requestReturn).toHaveBeenCalledWith(1, req.user);
      expect(result).toEqual(expected);
    });
  });
});
