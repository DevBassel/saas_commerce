import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from './constants/order-status.enum';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import {
  NOW,
  TENANT,
  buildMocks,
  customerCart,
  defaultAddress,
  manager,
  orderEntity,
  product,
  requester,
} from './orders.spec-helpers';

describe('OrdersService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildMocks();
    await expect(service.findAll(requester(), {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('checkout', () => {
    it('rejects an empty cart without writing anything', async () => {
      const { service, cartRepo, orderRepo, productRepo, cartItemRepo } =
        buildMocks();
      cartRepo.findOne.mockResolvedValue(null);

      await expect(service.checkout(7, {}, TENANT)).rejects.toThrow(
        'Cart is empty',
      );

      expect(productRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(cartItemRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects a cart whose items list is empty', async () => {
      const { service, cartRepo, orderRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue(customerCart([]));

      await expect(service.checkout(7, {}, TENANT)).rejects.toThrow(
        'Cart is empty',
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a line whose product no longer exists and rolls back', async () => {
      const {
        service,
        cartRepo,
        orderRepo,
        productQb,
        productRepo,
        cartItemRepo,
      } = buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([{ id: 1, cartId: 1, productId: 5, quantity: 1 }]),
      );
      productQb.getMany.mockResolvedValue([]);

      await expect(service.checkout(7, {}, TENANT)).rejects.toThrow(
        'Product 5 is no longer available',
      );

      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(productRepo.update).not.toHaveBeenCalled();
      expect(cartItemRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects an inactive product line', async () => {
      const { service, cartRepo, productQb, orderRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([{ id: 1, cartId: 1, productId: 5, quantity: 1 }]),
      );
      productQb.getMany.mockResolvedValue([product({ isActive: false })]);

      await expect(service.checkout(7, {}, TENANT)).rejects.toThrow(
        'SHIRT-1 is not available',
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a line that exceeds available stock', async () => {
      const { service, cartRepo, productQb, orderRepo, productRepo } =
        buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([{ id: 1, cartId: 1, productId: 5, quantity: 3 }]),
      );
      productQb.getMany.mockResolvedValue([product({ stock: 1 })]);

      await expect(service.checkout(7, {}, TENANT)).rejects.toThrow(
        'Insufficient stock for SHIRT-1',
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(productRepo.update).not.toHaveBeenCalled();
    });

    it('locks products, snapshots lines, decrements stock and clears the cart', async () => {
      const {
        service,
        cartRepo,
        productQb,
        productRepo,
        orderRepo,
        orderItemRepo,
        cartItemRepo,
        addressRepo,
        r2Mocks,
      } = buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([
          { id: 2, cartId: 1, productId: 5, quantity: 1 },
          { id: 1, cartId: 1, productId: 6, quantity: 3 },
        ]),
      );
      addressRepo.findOne.mockResolvedValue(defaultAddress());
      productQb.getMany.mockResolvedValue([
        product({
          id: 5,
          sku: 'SHIRT-1',
          price: 19.99,
          stock: 10,
          images: [{ id: 11, productId: 5, objectKey: 'a.jpg', position: 1 }],
        }),
        product({ id: 6, name: 'Hat', sku: 'HAT-1', price: 5, stock: 4 }),
      ]);

      const result = await service.checkout(7, {}, TENANT);

      expect(productQb.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
        undefined,
        ['product'],
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          subtotal: 34.99,
          total: 34.99,
          addressId: 3,
          recipientName: 'Jane Doe',
          phone: '+1 555 0100',
          line1: '1 Main St',
          city: 'Springfield',
          postalCode: '62701',
          country: 'US',
        }),
      );
      expect(addressRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 7, isDefault: true },
      });
      const savedOrder = orderRepo.save.mock.calls[0]?.[0] as
        Record<string, unknown> | undefined;
      expect(savedOrder?.orderNumber).toMatch(/^ORD-\d{8}-[A-Z2-7]{6}$/);
      expect(orderItemRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          orderId: 10,
          productId: 6,
          sku: 'HAT-1',
          unitPrice: 5,
          quantity: 3,
          lineTotal: 15,
          imageObjectKey: null,
        }),
        expect.objectContaining({
          orderId: 10,
          productId: 5,
          sku: 'SHIRT-1',
          unitPrice: 19.99,
          quantity: 1,
          lineTotal: 19.99,
          imageObjectKey: 'a.jpg',
        }),
      ]);
      expect(productRepo.update).toHaveBeenCalledWith({ id: 6 }, { stock: 1 });
      expect(productRepo.update).toHaveBeenCalledWith({ id: 5 }, { stock: 9 });
      expect(cartItemRepo.delete).toHaveBeenCalledWith({ cartId: 1 });

      expect(result).toMatchObject({
        id: 10,
        userId: 7,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        subtotal: 34.99,
        total: 34.99,
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ productId: 6, imageUrl: null });
      expect(result.items[1]).toMatchObject({
        productId: 5,
        imageUrl: 'https://cdn.test/a.jpg',
      });
      expect(result.deliveryAddress).toMatchObject({
        addressId: 3,
        recipientName: 'Jane Doe',
        phone: '+1 555 0100',
        line1: '1 Main St',
        line2: null,
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      });
      expect(r2Mocks.publicUrl).toHaveBeenCalledWith('a.jpg');
    });

    it('retries the transaction once on an order number collision', async () => {
      const { service, cartRepo, productQb, orderRepo, addressRepo } =
        buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([{ id: 1, cartId: 1, productId: 5, quantity: 1 }]),
      );
      productQb.getMany.mockResolvedValue([product()]);
      addressRepo.findOne.mockResolvedValue(defaultAddress());
      orderRepo.save.mockImplementationOnce(() => {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      });

      const result = await service.checkout(7, {}, TENANT);

      expect(orderRepo.manager.transaction).toHaveBeenCalledTimes(2);
      expect(result.id).toBe(10);
    });

    it('uses an explicit owned address and snapshots it', async () => {
      const { service, cartRepo, productQb, orderRepo, addressRepo } =
        buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([{ id: 1, cartId: 1, productId: 5, quantity: 1 }]),
      );
      productQb.getMany.mockResolvedValue([product()]);
      addressRepo.findOne.mockResolvedValue(
        defaultAddress({ id: 9, isDefault: false }),
      );

      await service.checkout(7, { addressId: 9 }, TENANT);

      expect(addressRepo.findOne).toHaveBeenCalledWith({
        where: { id: 9, userId: 7 },
      });
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ addressId: 9 }),
      );
    });

    it('rejects an unknown or foreign addressId without writing', async () => {
      const {
        service,
        cartRepo,
        productQb,
        productRepo,
        orderRepo,
        cartItemRepo,
        addressRepo,
      } = buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([{ id: 1, cartId: 1, productId: 5, quantity: 1 }]),
      );
      productQb.getMany.mockResolvedValue([product()]);
      addressRepo.findOne.mockResolvedValue(null);

      await expect(
        service.checkout(7, { addressId: 999 }, TENANT),
      ).rejects.toThrow('Delivery address not found');

      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(productRepo.update).not.toHaveBeenCalled();
      expect(cartItemRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects checkout with no default address without writing', async () => {
      const {
        service,
        cartRepo,
        productQb,
        productRepo,
        orderRepo,
        cartItemRepo,
        addressRepo,
      } = buildMocks();
      cartRepo.findOne.mockResolvedValue(
        customerCart([{ id: 1, cartId: 1, productId: 5, quantity: 1 }]),
      );
      productQb.getMany.mockResolvedValue([product()]);
      addressRepo.findOne.mockResolvedValue(null);

      await expect(service.checkout(7, {}, TENANT)).rejects.toThrow(
        'Delivery address required',
      );

      expect(addressRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 7, isDefault: true },
      });
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(productRepo.update).not.toHaveBeenCalled();
      expect(cartItemRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes a plain customer to their own orders and ignores filters', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.find.mockResolvedValue([]);

      await service.findAll(
        requester(),
        {
          status: OrderStatus.CONFIRMED,
          userId: 5,
        },
        TENANT,
      );

      expect(orderRepo.find).toHaveBeenCalledWith({
        where: { userId: 7 },
        relations: { items: true, user: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('lets a manager filter by status and user across all orders', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.find.mockResolvedValue([
        orderEntity({ userId: 5, status: OrderStatus.CONFIRMED }),
      ]);

      const result = await service.findAll(
        manager(),
        {
          status: OrderStatus.CONFIRMED,
          userId: 5,
        },
        TENANT,
      );

      expect(orderRepo.find).toHaveBeenCalledWith({
        where: { status: OrderStatus.CONFIRMED, userId: 5 },
        relations: { items: true, user: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws 404 for a non-owner so order ids cannot be enumerated', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity({ userId: 8 }));

      await expect(service.findOne(1, requester(), TENANT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('treats a null owner as manager-only', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity({ userId: null }));

      await expect(service.findOne(1, requester(), TENANT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the order to its owner', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity({ userId: 7 }));

      const result = await service.findOne(1, requester(), TENANT);

      expect(result).toMatchObject({ id: 1, userId: 7 });
    });

    it('lets a manager read any order', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity({ userId: 8 }));

      await expect(
        service.findOne(1, manager(), TENANT),
      ).resolves.toMatchObject({ id: 1 });
    });
  });

  describe('cancel', () => {
    it('cancels a pending owner order and restocks its lines', async () => {
      const { service, orderRepo, productRepo } = buildMocks();
      orderRepo.findOne
        .mockResolvedValueOnce(
          orderEntity({
            status: OrderStatus.PENDING,
            items: [
              { id: 1, productId: 5, quantity: 2 },
              { id: 2, productId: null, quantity: 1 },
            ],
          }),
        )
        .mockResolvedValueOnce(orderEntity({ status: OrderStatus.CANCELLED }));

      const result = await service.cancel(1, requester(), TENANT);

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { status: OrderStatus.CANCELLED },
      );
      expect(productRepo.increment).toHaveBeenCalledTimes(1);
      expect(productRepo.increment).toHaveBeenCalledWith({ id: 5 }, 'stock', 2);
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('rejects cancelling a delivered order', async () => {
      const { service, orderRepo, productRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ status: OrderStatus.DELIVERED }),
      );

      await expect(service.cancel(1, requester(), TENANT)).rejects.toThrow(
        'Order cannot be cancelled from DELIVERED',
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(productRepo.increment).not.toHaveBeenCalled();
    });

    it('rejects an owner cancelling a processing order', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ status: OrderStatus.PROCESSING }),
      );

      await expect(service.cancel(1, requester(), TENANT)).rejects.toThrow(
        BadRequestException,
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('lets a manager cancel a non-terminal processing order', async () => {
      const { service, orderRepo, productRepo } = buildMocks();
      orderRepo.findOne
        .mockResolvedValueOnce(
          orderEntity({
            userId: 8,
            status: OrderStatus.PROCESSING,
            items: [{ id: 1, productId: 5, quantity: 1 }],
          }),
        )
        .mockResolvedValueOnce(
          orderEntity({ userId: 8, status: OrderStatus.CANCELLED }),
        );

      await service.cancel(1, manager(), TENANT);

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { status: OrderStatus.CANCELLED },
      );
      expect(productRepo.increment).toHaveBeenCalledWith({ id: 5 }, 'stock', 1);
    });

    it('throws 404 for a non-owner', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity({ userId: 8 }));

      await expect(service.cancel(1, requester(), TENANT)).rejects.toThrow(
        NotFoundException,
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a manager cancelling a return-requested order', async () => {
      const { service, orderRepo, productRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ userId: 8, status: OrderStatus.RETURN_REQUESTED }),
      );

      await expect(service.cancel(1, manager(), TENANT)).rejects.toThrow(
        'Order cannot be cancelled from RETURN_REQUESTED',
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(productRepo.increment).not.toHaveBeenCalled();
    });

    it('refunds a paid order, restocks it and mirrors the refund', async () => {
      const { service, orderRepo, productRepo, paymentsMocks } = buildMocks();
      orderRepo.findOne
        .mockResolvedValueOnce(
          orderEntity({
            status: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            items: [{ id: 1, productId: 5, quantity: 2 }],
          }),
        )
        .mockResolvedValueOnce(
          orderEntity({
            status: OrderStatus.CANCELLED,
            paymentStatus: PaymentStatus.REFUNDED,
            refundedAt: NOW,
          }),
        );
      paymentsMocks.refundOrder.mockResolvedValue({ refundedAt: NOW });

      const result = await service.cancel(1, requester(), TENANT);

      expect(paymentsMocks.refundOrder).toHaveBeenCalledTimes(1);
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.REFUNDED,
          refundedAt: NOW,
        },
      );
      expect(productRepo.increment).toHaveBeenCalledWith({ id: 5 }, 'stock', 2);
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('aborts the cancel when the refund fails', async () => {
      const { service, orderRepo, productRepo, paymentsMocks } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          items: [{ id: 1, productId: 5, quantity: 2 }],
        }),
      );
      paymentsMocks.refundOrder.mockRejectedValue(
        new BadRequestException('Refund could not be processed'),
      );

      await expect(service.cancel(1, requester(), TENANT)).rejects.toThrow(
        'Refund could not be processed',
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(productRepo.increment).not.toHaveBeenCalled();
    });

    it('does not refund an unpaid order', async () => {
      const { service, orderRepo, paymentsMocks } = buildMocks();
      orderRepo.findOne
        .mockResolvedValueOnce(
          orderEntity({ status: OrderStatus.PENDING, items: [] }),
        )
        .mockResolvedValueOnce(orderEntity({ status: OrderStatus.CANCELLED }));

      await service.cancel(1, requester(), TENANT);

      expect(paymentsMocks.refundOrder).not.toHaveBeenCalled();
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { status: OrderStatus.CANCELLED },
      );
    });
  });

  describe('requestReturn', () => {
    it('requests a return for an owner delivered order without restocking', async () => {
      const { service, orderRepo, productRepo } = buildMocks();
      orderRepo.findOne
        .mockResolvedValueOnce(
          orderEntity({
            status: OrderStatus.DELIVERED,
            items: [{ id: 1, productId: 5, quantity: 2 }],
          }),
        )
        .mockResolvedValueOnce(
          orderEntity({ status: OrderStatus.RETURN_REQUESTED }),
        );

      const result = await service.requestReturn(1, requester(), TENANT);

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { status: OrderStatus.RETURN_REQUESTED },
      );
      expect(productRepo.increment).not.toHaveBeenCalled();
      expect(result.status).toBe(OrderStatus.RETURN_REQUESTED);
    });

    it('throws 404 for a non-owner', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ userId: 8, status: OrderStatus.DELIVERED }),
      );

      await expect(
        service.requestReturn(1, requester(), TENANT),
      ).rejects.toThrow(NotFoundException);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('rejects an order that is not delivered', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ status: OrderStatus.PROCESSING }),
      );

      await expect(
        service.requestReturn(1, requester(), TENANT),
      ).rejects.toThrow('Return can only be requested for a delivered order');
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('lets a manager request a return on another user order', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne
        .mockResolvedValueOnce(
          orderEntity({ userId: 8, status: OrderStatus.DELIVERED }),
        )
        .mockResolvedValueOnce(
          orderEntity({ userId: 8, status: OrderStatus.RETURN_REQUESTED }),
        );

      await service.requestReturn(1, manager(), TENANT);

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { status: OrderStatus.RETURN_REQUESTED },
      );
    });
  });
});
