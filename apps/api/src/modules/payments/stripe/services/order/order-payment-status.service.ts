import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Order } from '../../../../orders/entities/order.entity';
import { paymentMetaData } from '../../../constants/payment-metadata';
import { PaymentStatus } from '../../../constants/payment-status.enum';
import { Payment } from '../../../entities/payment.entity';

@Injectable()
export class OrderPaymentStatusService {
  async successOrderPayment(
    paymentRepo: Repository<Payment>,
    orderRepo: Repository<Order>,
    { orderId, userId }: paymentMetaData,
    paymentId: string,
  ) {
    return paymentRepo.manager.transaction(async (manager) => {
      const paymentRepository = manager.withRepository(paymentRepo);
      const orderRepository = manager.withRepository(orderRepo);

      const payment = await paymentRepository.findOne({
        where: { paymentRef: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      const order = await orderRepository.findOne({
        where: { id: orderId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Preserve terminal status while repairing success timestamps when a
      // refund event arrived before Stripe delivered payment_intent.succeeded.
      if (
        payment.status === PaymentStatus.PAID ||
        payment.status === PaymentStatus.REFUND_PENDING ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED
      ) {
        const paidAt = payment.paidAt ?? order.paidAt ?? new Date();
        if (!payment.paidAt) {
          paymentRepository.merge(payment, { paidAt });
          await paymentRepository.save(payment);
        }
        if (!order.paidAt || order.paymentStatus !== payment.status) {
          orderRepository.merge(order, {
            paymentStatus: payment.status,
            paidAt,
          });
          await orderRepository.save(order);
        }
        return;
      }
      if (payment.status === PaymentStatus.CANCELED) return;

      const paidAt = new Date();

      paymentRepository.merge(payment, {
        status: PaymentStatus.PAID,
        paidAt,
      });

      orderRepository.merge(order, {
        paymentStatus: PaymentStatus.PAID,
        paidAt,
      });

      await paymentRepository.save(payment);
      await orderRepository.save(order);

      return {
        paymentId: payment.id,
        orderId: order.id,
        status: PaymentStatus.PAID,
      };
    });
  }

  async cancelOrderPayment(
    paymentRepo: Repository<Payment>,
    orderRepo: Repository<Order>,
    { orderId, userId }: paymentMetaData,
    paymentId: string,
  ) {
    return paymentRepo.manager.transaction(async (manager) => {
      const paymentRepository = manager.withRepository(paymentRepo);
      const orderRepository = manager.withRepository(orderRepo);

      const payment = await paymentRepository.findOne({
        where: { paymentRef: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      const order = await orderRepository.findOne({
        where: { id: orderId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      if (
        payment.status === PaymentStatus.PAID ||
        payment.status === PaymentStatus.REFUND_PENDING ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
        payment.status === PaymentStatus.CANCELED
      )
        return;

      const canceledAt = new Date();

      paymentRepository.merge(payment, {
        status: PaymentStatus.CANCELED,
        canceledAt,
      } as Partial<Payment>);

      orderRepository.merge(order, {
        paymentStatus: PaymentStatus.UNPAID,
        canceledAt,
      } as Partial<Order>);

      await paymentRepository.save(payment);
      await orderRepository.save(order);

      return {
        paymentId: payment.id,
        orderId: order.id,
        status: PaymentStatus.CANCELED,
      };
    });
  }

  async failedOrderPayment(
    paymentRepo: Repository<Payment>,
    orderRepo: Repository<Order>,
    { orderId, userId }: paymentMetaData,
    paymentId: string,
  ) {
    return paymentRepo.manager.transaction(async (manager) => {
      const paymentRepository = manager.withRepository(paymentRepo);
      const orderRepository = manager.withRepository(orderRepo);

      const payment = await paymentRepository.findOne({
        where: { paymentRef: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      const order = await orderRepository.findOne({
        where: { id: orderId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      if (
        payment.status === PaymentStatus.PAID ||
        payment.status === PaymentStatus.REFUND_PENDING ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
        payment.status === PaymentStatus.CANCELED
      )
        return;

      const failedAt = new Date();

      paymentRepository.merge(payment, {
        status: PaymentStatus.FAILED,
        failedAt,
      } as Partial<Payment>);

      orderRepository.merge(order, {
        paymentStatus: PaymentStatus.FAILED,
        failedAt,
      } as Partial<Order>);

      await paymentRepository.save(payment);
      await orderRepository.save(order);

      return {
        paymentId: payment.id,
        orderId: order.id,
        status: PaymentStatus.FAILED,
      };
    });
  }
}
