import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '../constants/order-status.enum';
import { PaymentStatus } from '../../payments/constants/payment-status.enum';
import { NOW, TENANT, buildMocks, orderEntity } from '../orders.spec-helpers';

describe('ManageOrderService', () => {
  describe('updateStatus', () => {
    it('rejects an invalid transition', async () => {
      const { manageService, orderRepo, cacheMocks } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ status: OrderStatus.PENDING }),
      );

      await expect(
        manageService.updateStatus(1, { status: OrderStatus.SHIPPED }, TENANT),
      ).rejects.toThrow('Cannot change order status from PENDING to SHIPPED');
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(cacheMocks.invalidateProducts).not.toHaveBeenCalled();
    });

    it('blocks every transition while a refund is pending', async () => {
      const { manageService, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.REFUND_PENDING,
        }),
      );

      await expect(
        manageService.updateStatus(
          1,
          { status: OrderStatus.PROCESSING },
          TENANT,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('applies a valid forward transition', async () => {
      const { manageService, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ status: OrderStatus.PENDING }),
      );

      const result = await manageService.updateStatus(
        1,
        { status: OrderStatus.CONFIRMED },
        TENANT,
      );

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1, status: OrderStatus.PENDING },
        { status: OrderStatus.CONFIRMED },
      );
      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(
        orderRepo.manager.transaction.mock.invocationCallOrder[0],
      ).toBeLessThan(orderRepo.findOne.mock.invocationCallOrder[0]);
      expect(orderRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { items: true },
        relationLoadStrategy: 'query',
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('restocks when transitioning to cancelled', async () => {
      const { manageService, orderRepo, productRepo, cacheMocks } =
        buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.CONFIRMED,
          items: [{ id: 1, productId: 5, quantity: 2 }],
        }),
      );

      const result = await manageService.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        TENANT,
      );

      expect(productRepo.increment).toHaveBeenCalledWith({ id: 5 }, 'stock', 2);
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(cacheMocks.invalidateProducts).toHaveBeenCalledWith(TENANT);
    });

    it('restores coupon usage when a manager cancels a coupon order', async () => {
      const { manageService, orderRepo, entityManager, couponsMocks } =
        buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.CONFIRMED,
          couponId: 5,
          items: [{ id: 1, productId: 5, quantity: 2 }],
        }),
      );

      await manageService.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        TENANT,
      );

      expect(couponsMocks.restoreUsage).toHaveBeenCalledWith(
        entityManager,
        expect.objectContaining({ couponId: 5 }),
      );
    });

    it('delegates paid cancellation to the durable refund coordinator', async () => {
      const { manageService, orderRepo, productRepo, paymentsMocks } =
        buildMocks();
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
      paymentsMocks.refundOrder.mockResolvedValue({
        refundStatus: 'SUCCEEDED',
        refundedAt: NOW,
      });

      const result = await manageService.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        TENANT,
      );

      expect(paymentsMocks.refundOrder).toHaveBeenCalledTimes(1);
      expect(paymentsMocks.refundOrder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        OrderStatus.CANCELLED,
        TENANT,
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(productRepo.increment).not.toHaveBeenCalled();
      expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
    });

    it('restocks when a return request is approved', async () => {
      const { manageService, orderRepo, productRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.RETURN_REQUESTED,
          items: [{ id: 1, productId: 5, quantity: 2 }],
        }),
      );

      const result = await manageService.updateStatus(
        1,
        { status: OrderStatus.RETURNED },
        TENANT,
      );

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1, status: OrderStatus.RETURN_REQUESTED },
        { status: OrderStatus.RETURNED },
      );
      expect(productRepo.increment).toHaveBeenCalledWith({ id: 5 }, 'stock', 2);
      expect(result.status).toBe(OrderStatus.RETURNED);
    });

    it('does not restock when a return request is rejected', async () => {
      const { manageService, orderRepo, productRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.RETURN_REQUESTED,
          items: [{ id: 1, productId: 5, quantity: 2 }],
        }),
      );

      const result = await manageService.updateStatus(
        1,
        { status: OrderStatus.DELIVERED },
        TENANT,
      );

      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1, status: OrderStatus.RETURN_REQUESTED },
        { status: OrderStatus.DELIVERED },
      );
      expect(productRepo.increment).not.toHaveBeenCalled();
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('rejects skipping the return request step', async () => {
      const { manageService, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ status: OrderStatus.DELIVERED }),
      );

      await expect(
        manageService.updateStatus(1, { status: OrderStatus.RETURNED }, TENANT),
      ).rejects.toThrow(
        'Cannot change order status from DELIVERED to RETURNED',
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('throws 404 when the order does not exist', async () => {
      const { manageService, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        manageService.updateStatus(
          1,
          { status: OrderStatus.CONFIRMED },
          TENANT,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates paid return to the durable refund coordinator', async () => {
      const { manageService, orderRepo, productRepo, paymentsMocks } =
        buildMocks();
      orderRepo.findOne
        .mockResolvedValueOnce(
          orderEntity({
            status: OrderStatus.RETURN_REQUESTED,
            paymentStatus: PaymentStatus.PAID,
            items: [{ id: 1, productId: 5, quantity: 2 }],
          }),
        )
        .mockResolvedValueOnce(
          orderEntity({
            status: OrderStatus.RETURNED,
            paymentStatus: PaymentStatus.REFUNDED,
            refundedAt: NOW,
          }),
        );
      paymentsMocks.refundOrder.mockResolvedValue({
        refundStatus: 'SUCCEEDED',
        refundedAt: NOW,
      });

      const result = await manageService.updateStatus(
        1,
        { status: OrderStatus.RETURNED },
        TENANT,
      );

      expect(paymentsMocks.refundOrder).toHaveBeenCalledTimes(1);
      expect(paymentsMocks.refundOrder).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        OrderStatus.RETURNED,
        TENANT,
      );
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(productRepo.increment).not.toHaveBeenCalled();
      expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
    });

    it('does not mutate the order when a paid order cannot be refunded', async () => {
      const { manageService, orderRepo, productRepo, paymentsMocks } =
        buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          items: [{ id: 1, productId: 5, quantity: 2 }],
        }),
      );
      paymentsMocks.refundOrder.mockResolvedValue(null);

      await expect(
        manageService.updateStatus(
          1,
          { status: OrderStatus.CANCELLED },
          TENANT,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(productRepo.increment).not.toHaveBeenCalled();
    });

    it('does not refund an unpaid order that is cancelled', async () => {
      const { manageService, orderRepo, paymentsMocks } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
        }),
      );

      await manageService.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        TENANT,
      );

      expect(paymentsMocks.refundOrder).not.toHaveBeenCalled();
    });
  });
});
