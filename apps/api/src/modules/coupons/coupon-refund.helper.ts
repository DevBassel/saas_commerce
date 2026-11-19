import { EntityManager } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Coupon } from './entities/coupon.entity';
import { CouponRedemption } from './entities/coupon-redemption.entity';

/** Restores one full-order coupon redemption inside caller transaction. */
export async function restoreCouponUsage(
  manager: EntityManager,
  order: Order,
): Promise<void> {
  if (order.couponId == null) return;

  const coupons = manager.getRepository(Coupon);
  const redemptions = manager.getRepository(CouponRedemption);
  const deleted = await redemptions.delete({
    orderId: order.id,
    couponId: order.couponId,
  });
  if (!deleted.affected) return;

  await coupons
    .createQueryBuilder()
    .update(Coupon)
    .set({ usageCount: () => '"usageCount" - 1' })
    .where('id = :id', { id: order.couponId })
    .andWhere('"usageCount" > 0')
    .execute();
}
