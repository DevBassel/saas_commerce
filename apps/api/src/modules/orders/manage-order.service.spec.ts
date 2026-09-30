import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from './constants/order-status.enum';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import { NOW, TENANT, buildMocks, orderEntity } from './orders.spec-helpers';

describe('ManageOrderService', () => {
  describe('updateStatus', () => {
    it('rejects an invalid transition', async () => {
      const { manageService, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ status: OrderStatus.PENDING }),
      );

      await expect(
        manageService.updateStatus(1, { status: OrderStatus.SHIPPED }, TENANT),
      ).rejects.toThrow('Cannot change order status from PENDING to SHIPPED');
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
        { id: 1 },
        { status: OrderStatus.CONFIRMED },
      );
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('restocks when transitioning to cancelled', async () => {
      const { manageService, orderRepo, productRepo } = buildMocks();
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
    });

    it('refunds a paid order when a manager cancels it', async () => {
      const { manageService, orderRepo, productRepo, paymentsMocks } =
        buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          items: [{ id: 1, productId: 5, quantity: 2 }],
        }),
      );
      paymentsMocks.refundOrder.mockResolvedValue({ refundedAt: NOW });

      const result = await manageService.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        TENANT,
      );

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
        { id: 1 },
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
        { id: 1 },
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
  });
});
