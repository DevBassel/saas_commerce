import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { R2Service } from '../../common/storage/r2.service';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import { Product } from '../products/entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatus } from './constants/order-status.enum';
import { DiscountType } from '../coupons/constants/discount-type.enum';
import {
  refundOrderIfPaid,
  restockOrderItems,
  serializeDeliveryAddress,
  serializeOrder,
  serializeOrderItem,
} from './orders.helpers';

const NOW = new Date('2026-01-01T00:00:00Z');

const r2 = {
  publicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
} as unknown as R2Service;

const item = (overrides: Partial<OrderItem> = {}): OrderItem =>
  ({
    id: 1,
    productId: 5,
    name: 'Shirt',
    sku: 'SHIRT-1',
    unitPrice: 10,
    quantity: 2,
    lineTotal: 20,
    imageObjectKey: 'tenants/t/products/a.png',
    ...overrides,
  }) as OrderItem;

const order = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 1,
    orderNumber: 'ORD-1',
    userId: 7,
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    subtotal: 20,
    total: 20,
    paidAt: null,
    refundedAt: null,
    items: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }) as Order;

describe('serializeOrder', () => {
  it('maps the order and nested user', () => {
    const result = serializeOrder(
      order({ user: { id: 7, name: 'Jane' } as never }),
      r2,
    );

    expect(result).toEqual({
      id: 1,
      orderNumber: 'ORD-1',
      userId: 7,
      user: { id: 7, name: 'Jane' },
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      subtotal: 20,
      discountAmount: 0,
      coupon: null,
      total: 20,
      items: [],
      deliveryAddress: null,
      paidAt: null,
      refundedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('serializes the coupon snapshot and discount', () => {
    const result = serializeOrder(
      order({
        couponId: 9,
        couponCode: 'SAVE10',
        couponDiscountType: DiscountType.PERCENTAGE,
        couponDiscountValue: 10,
        discountAmount: 2,
        total: 18,
      }),
      r2,
    );

    expect(result).toMatchObject({
      discountAmount: 2,
      total: 18,
      coupon: {
        id: 9,
        code: 'SAVE10',
        type: DiscountType.PERCENTAGE,
        value: 10,
      },
    });
  });

  it('nulls the user and userId when absent', () => {
    const result = serializeOrder(
      order({ user: undefined, userId: undefined }),
      r2,
    );
    expect(result.user).toBeNull();
    expect(result.userId).toBeNull();
  });

  it('sorts items by id and serializes their images', () => {
    const result = serializeOrder(
      order({
        items: [
          item({ id: 3, imageObjectKey: 'k3' }),
          item({ id: 1, imageObjectKey: null }),
          item({ id: 2, imageObjectKey: 'k2' }),
        ],
      }),
      r2,
    );

    expect(result.items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(result.items[0].imageUrl).toBeNull();
    expect(result.items[1].imageUrl).toBe('https://cdn.test/k2');
  });

  it('defaults a missing items array to an empty list', () => {
    expect(serializeOrder(order({ items: undefined }), r2).items).toEqual([]);
  });

  it('preserves paidAt and refundedAt when present', () => {
    const paid = new Date('2026-02-01T00:00:00Z');
    const result = serializeOrder(order({ paidAt: paid }), r2);
    expect(result.paidAt).toBe(paid);
  });
});

describe('serializeDeliveryAddress', () => {
  it('returns null when both the address id and recipient are absent', () => {
    expect(serializeDeliveryAddress(order())).toBeNull();
  });

  it('returns the snapshot when a recipient is present', () => {
    const result = serializeDeliveryAddress(
      order({
        recipientName: 'Jane',
        phone: '+1',
        line1: '1 Main',
        line2: null,
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      }),
    );

    expect(result).toEqual({
      addressId: null,
      recipientName: 'Jane',
      phone: '+1',
      line1: '1 Main',
      line2: null,
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
    });
  });

  it('returns the snapshot when only an address id is present', () => {
    const result = serializeDeliveryAddress(order({ addressId: 3 }));
    expect(result?.addressId).toBe(3);
    expect(result?.recipientName).toBe('');
  });

  it('coerces missing optional fields to empty strings or null', () => {
    const result = serializeDeliveryAddress(
      order({ recipientName: 'Jane', line2: undefined, state: undefined }),
    );

    expect(result?.phone).toBe('');
    expect(result?.line1).toBe('');
    expect(result?.city).toBe('');
    expect(result?.postalCode).toBe('');
    expect(result?.country).toBe('');
    expect(result?.line2).toBeNull();
    expect(result?.state).toBeNull();
  });
});

describe('serializeOrderItem', () => {
  it('builds an image url when an object key exists', () => {
    expect(serializeOrderItem(item(), r2).imageUrl).toBe(
      'https://cdn.test/tenants/t/products/a.png',
    );
  });

  it('returns null image and product id when absent', () => {
    const result = serializeOrderItem(
      item({ imageObjectKey: null, productId: null }),
      r2,
    );
    expect(result.imageUrl).toBeNull();
    expect(result.productId).toBeNull();
  });
});

describe('refundOrderIfPaid', () => {
  const payments = {
    refundOrder: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('does nothing for an unpaid order', async () => {
    await expect(
      refundOrderIfPaid(order(), { schemaName: 't' }, payments as never),
    ).resolves.toBeNull();
    expect(payments.refundOrder).not.toHaveBeenCalled();
  });

  it('returns the refund timestamp for a paid order', async () => {
    const refundedAt = new Date('2026-03-01T00:00:00Z');
    payments.refundOrder.mockResolvedValue({ refundedAt });

    await expect(
      refundOrderIfPaid(
        order({ paymentStatus: PaymentStatus.PAID }),
        { schemaName: 't' },
        payments as never,
      ),
    ).resolves.toBe(refundedAt);
    expect(payments.refundOrder).toHaveBeenCalledWith(expect.anything(), {
      schemaName: 't',
    });
  });

  it('throws when an order is marked paid but has no refundable payment', async () => {
    payments.refundOrder.mockResolvedValue(null);

    await expect(
      refundOrderIfPaid(
        order({ paymentStatus: PaymentStatus.PAID }),
        { schemaName: 't' },
        payments as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('restockOrderItems', () => {
  it('increments stock for items with a product id and skips detached lines', async () => {
    const increment = jest.fn().mockResolvedValue(undefined);
    const manager = {
      getRepository: jest.fn(() => ({ increment })),
    };

    await restockOrderItems(manager as unknown as EntityManager, [
      item({ productId: 5, quantity: 2 }),
      item({ productId: null, quantity: 1 }),
      item({ productId: 6, quantity: 3 }),
    ]);

    expect(manager.getRepository).toHaveBeenCalledWith(Product);
    expect(increment).toHaveBeenCalledTimes(2);
    expect(increment).toHaveBeenCalledWith({ id: 5 }, 'stock', 2);
    expect(increment).toHaveBeenCalledWith({ id: 6 }, 'stock', 3);
  });

  it('does nothing for an empty list', async () => {
    const increment = jest.fn();
    const manager = {
      getRepository: jest.fn(() => ({ increment })),
    } as unknown as EntityManager;

    await restockOrderItems(manager, []);

    expect(increment).not.toHaveBeenCalled();
  });
});
