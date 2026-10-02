import { OrdersService } from './orders.service';
import { ManageOrderService } from './manage-order.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Address } from '../addresses/entities/address.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { R2Service } from '../../common/storage/r2.service';
import { OrderStatus } from './constants/order-status.enum';
import { OrderPermissionKey } from './constants/order-permissions.enum';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import StripePaymentService from '../payments/stripe.payment.service';
import { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

export const TENANT = { schemaName: 'tenant_test' };
export const NOW = new Date('2026-01-01T00:00:00.000Z');

export const requester = (
  overrides: Partial<RequestWithUser['user']> = {},
): RequestWithUser['user'] => ({
  id: 7,
  name: 'Customer',
  email: 'customer@test.com',
  role: null,
  permissions: [
    OrderPermissionKey.CREATE,
    OrderPermissionKey.READ,
    OrderPermissionKey.CANCEL,
    OrderPermissionKey.RETURN,
  ],
  ...overrides,
});

export const manager = (): RequestWithUser['user'] =>
  requester({
    id: 99,
    email: 'admin@test.com',
    permissions: [OrderPermissionKey.READ, OrderPermissionKey.MANAGE],
  });

export const product = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  name: 'Shirt',
  sku: 'SHIRT-1',
  price: 19.99,
  stock: 10,
  isActive: true,
  images: [] as unknown[],
  ...overrides,
});

export const orderEntity = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: 1,
  orderNumber: 'ORD-20260101-ABCDEF',
  userId: 7,
  status: OrderStatus.PENDING,
  paymentStatus: PaymentStatus.UNPAID,
  subtotal: 10,
  total: 10,
  paidAt: null,
  refundedAt: null,
  items: [] as unknown[],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

export const buildMocks = () => {
  const orderRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: Record<string, unknown>) => ({
      id: 10,
      createdAt: NOW,
      updatedAt: NOW,
      ...data,
    })),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const orderItemRepo = {
    create: jest.fn((data: unknown) => data),
    insert: jest.fn((data: unknown) => {
      const rows = Array.isArray(data) ? data : [data];
      return { identifiers: rows.map((_, index) => ({ id: index + 1 })) };
    }),
    save: jest.fn((data: unknown) =>
      Array.isArray(data)
        ? data.map((item, index) => ({
            id: index + 1,
            createdAt: NOW,
            ...(item as Record<string, unknown>),
          }))
        : { id: 1, createdAt: NOW, ...(data as Record<string, unknown>) },
    ),
  };
  const productQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const productRepo = {
    createQueryBuilder: jest.fn(() => productQb),
    update: jest.fn(),
    increment: jest.fn(),
  };
  const cartRepo = { findOne: jest.fn() };
  const cartItemRepo = { delete: jest.fn() };
  const addressRepo = { findOne: jest.fn() };

  const productUpdateQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const entityManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Order) return orderRepo;
      if (entity === OrderItem) return orderItemRepo;
      if (entity === Product) return productRepo;
      if (entity === Cart) return cartRepo;
      if (entity === CartItem) return cartItemRepo;
      if (entity === Address) return addressRepo;
      return orderRepo;
    }),
    createQueryBuilder: jest.fn(() => productUpdateQb),
  };
  orderRepo.manager.transaction = jest.fn((callback: (m: unknown) => unknown) =>
    callback(entityManager),
  );

  const tenantManager = {
    getRepository: jest.fn(() => Promise.resolve(orderRepo)),
  } as unknown as TenantManagerService;

  const r2Mocks = {
    publicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
  };
  const r2 = r2Mocks as unknown as R2Service;

  const paymentsMocks = {
    refundOrder: jest.fn(),
  };

  const service = new OrdersService(
    tenantManager,
    r2,
    paymentsMocks as unknown as StripePaymentService,
  );
  const manageService = new ManageOrderService(
    tenantManager,
    r2,
    paymentsMocks as unknown as StripePaymentService,
  );

  return {
    service,
    manageService,
    orderRepo,
    orderItemRepo,
    productRepo,
    productQb,
    productUpdateQb,
    cartRepo,
    cartItemRepo,
    addressRepo,
    entityManager,
    r2Mocks,
    paymentsMocks,
  };
};

export const customerCart = (
  items: Record<string, unknown>[],
): Record<string, unknown> => ({ id: 1, userId: 7, items });

export const defaultAddress = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: 3,
  userId: 7,
  recipientName: 'Jane Doe',
  phone: '+1 555 0100',
  line1: '1 Main St',
  line2: null,
  city: 'Springfield',
  state: 'IL',
  postalCode: '62701',
  country: 'US',
  label: 'Home',
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});
