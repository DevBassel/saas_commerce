import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User } from '../users/entities/user.entity';
import { Role } from '../rbac/entities/role.entity';
import { Permission } from '../rbac/entities/permission.entity';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Category } from '../categories/entities/category.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Address } from '../addresses/entities/address.entity';

export const TENANT_ENTITIES: PostgresConnectionOptions['entities'] = [
  User,
  Role,
  Permission,
  Product,
  ProductImage,
  Category,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Payment,
  Address,
];
