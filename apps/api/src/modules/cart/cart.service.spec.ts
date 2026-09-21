import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { TenantManagerService } from '../tenants/tenant-manager.service';
import { R2Service } from '../../common/storage/r2.service';
import { MAX_CART_ITEMS } from './constants/cart.constants';

const TENANT = { schemaName: 'tenant_test' };
const NOW = new Date('2026-01-01T00:00:00.000Z');

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  name: 'Shirt',
  sku: 'SHIRT-1',
  price: 19.99,
  stock: 10,
  isActive: true,
  images: [] as unknown[],
  ...overrides,
});

const buildMocks = () => {
  const cartRepo = {
    findOne: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const itemRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => data),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const productRepo = {
    findOneBy: jest.fn(),
    find: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Cart) return cartRepo;
      if (entity === CartItem) return itemRepo;
      return productRepo;
    }),
  };
  cartRepo.manager.transaction = jest.fn((callback: (m: unknown) => unknown) =>
    callback(manager),
  );

  const tenantManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Cart) return Promise.resolve(cartRepo);
      if (entity === CartItem) return Promise.resolve(itemRepo);
      return Promise.resolve(productRepo);
    }),
  } as unknown as TenantManagerService;

  const r2Mocks = {
    publicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
  };
  const r2 = r2Mocks as unknown as R2Service;

  const service = new CartService(tenantManager, r2);

  return { service, cartRepo, itemRepo, productRepo, manager, r2Mocks };
};

describe('CartService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildMocks();
    await expect(service.getCart(1)).rejects.toThrow(ForbiddenException);
  });

  describe('getCart', () => {
    it('returns a synthetic empty cart without writing when none exists', async () => {
      const { service, cartRepo, productRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue(null);

      const result = await service.getCart(7, TENANT);

      expect(result).toEqual({
        id: null,
        userId: 7,
        items: [],
        subtotal: 0,
        totalItems: 0,
        totalQuantity: 0,
        createdAt: null,
        updatedAt: null,
      });
      expect(cartRepo.save).not.toHaveBeenCalled();
      expect(productRepo.find).not.toHaveBeenCalled();
    });

    it('enriches items with product data, primary image, and totals', async () => {
      const { service, cartRepo, productRepo, r2Mocks } = buildMocks();
      cartRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 7,
        createdAt: NOW,
        updatedAt: NOW,
        items: [
          { id: 2, cartId: 1, productId: 5, quantity: 1 },
          { id: 1, cartId: 1, productId: 5, quantity: 3 },
        ],
      });
      productRepo.find.mockResolvedValue([
        product({
          images: [
            { id: 11, productId: 5, objectKey: 'b.jpg', position: 2 },
            { id: 10, productId: 5, objectKey: 'a.jpg', position: 1 },
          ],
        }),
      ]);

      const result = await service.getCart(7, TENANT);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        productId: 5,
        name: 'Shirt',
        sku: 'SHIRT-1',
        unitPrice: 19.99,
        quantity: 3,
        lineTotal: 59.97,
        isActive: true,
        isAvailable: true,
        availableStock: 10,
        imageUrl: 'https://cdn.test/a.jpg',
      });
      expect(result.items[1]).toMatchObject({ quantity: 1, lineTotal: 19.99 });
      expect(result.subtotal).toBe(79.96);
      expect(result.totalItems).toBe(2);
      expect(result.totalQuantity).toBe(4);
      expect(r2Mocks.publicUrl).toHaveBeenCalledWith('a.jpg');
    });

    it('flags unavailable lines without deleting or mutating quantity', async () => {
      const { service, cartRepo, productRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 7,
        createdAt: NOW,
        updatedAt: NOW,
        items: [
          { id: 1, cartId: 1, productId: 5, quantity: 3 },
          { id: 2, cartId: 1, productId: 6, quantity: 1 },
        ],
      });
      productRepo.find.mockResolvedValue([
        product({ id: 5, stock: 2, images: [] }),
        product({ id: 6, isActive: false, images: [] }),
      ]);

      const result = await service.getCart(7, TENANT);

      expect(result.items[0]).toMatchObject({
        quantity: 3,
        availableStock: 2,
        isAvailable: false,
      });
      expect(result.items[1]).toMatchObject({
        isActive: false,
        isAvailable: false,
      });
      expect(cartRepo.delete).not.toHaveBeenCalled();
      expect(cartRepo.update).not.toHaveBeenCalled();
    });

    it('uses a null imageUrl when the product has no images', async () => {
      const { service, cartRepo, productRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 7,
        createdAt: NOW,
        updatedAt: NOW,
        items: [{ id: 1, cartId: 1, productId: 5, quantity: 1 }],
      });
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      const result = await service.getCart(7, TENANT);

      expect(result.items[0].imageUrl).toBeNull();
    });

    it('skips lines whose product cannot be loaded', async () => {
      const { service, cartRepo, productRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 7,
        createdAt: NOW,
        updatedAt: NOW,
        items: [{ id: 1, cartId: 1, productId: 5, quantity: 1 }],
      });
      productRepo.find.mockResolvedValue([]);

      const result = await service.getCart(7, TENANT);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
      expect(result.subtotal).toBe(0);
    });
  });

  describe('addItem', () => {
    it('merges quantity into an existing line', async () => {
      const { service, cartRepo, itemRepo, productRepo, manager } =
        buildMocks();
      productRepo.findOneBy.mockResolvedValue(product({ stock: 10 }));
      cartRepo.findOne
        .mockResolvedValueOnce({ id: 1, userId: 7 })
        .mockResolvedValueOnce({
          id: 1,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [{ id: 3, cartId: 1, productId: 5, quantity: 3 }],
        });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 2,
      });
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      const result = await service.addItem(
        7,
        { productId: 5, quantity: 1 },
        TENANT,
      );

      expect(manager.getRepository).toHaveBeenCalled();
      expect(itemRepo.update).toHaveBeenCalledWith({ id: 3 }, { quantity: 3 });
      expect(itemRepo.save).not.toHaveBeenCalled();
      expect(result.totalQuantity).toBe(3);
    });

    it('defaults to a quantity of one and increments an existing line', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product());
      cartRepo.findOne
        .mockResolvedValueOnce({ id: 1, userId: 7 })
        .mockResolvedValueOnce({
          id: 1,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [{ id: 3, cartId: 1, productId: 5, quantity: 2 }],
        });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 1,
      });
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      await service.addItem(7, { productId: 5 }, TENANT);

      expect(itemRepo.update).toHaveBeenCalledWith({ id: 3 }, { quantity: 2 });
    });

    it('creates a new line when the product is not in the cart', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product());
      cartRepo.findOne
        .mockResolvedValueOnce({ id: 1, userId: 7 })
        .mockResolvedValueOnce({
          id: 1,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [{ id: 4, cartId: 1, productId: 5, quantity: 2 }],
        });
      itemRepo.findOne.mockResolvedValue(null);
      itemRepo.count.mockResolvedValue(0);
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      await service.addItem(7, { productId: 5, quantity: 2 }, TENANT);

      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 1, productId: 5, quantity: 2 }),
      );
    });

    it('creates the cart row when the user has none', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product());
      cartRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 9,
        userId: 7,
        createdAt: NOW,
        updatedAt: NOW,
        items: [{ id: 1, cartId: 9, productId: 5, quantity: 1 }],
      });
      cartRepo.save.mockResolvedValue({ id: 9, userId: 7 });
      itemRepo.findOne.mockResolvedValue(null);
      itemRepo.count.mockResolvedValue(0);
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      await service.addItem(7, { productId: 5 }, TENANT);

      expect(cartRepo.save).toHaveBeenCalledWith({ userId: 7 });
      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 9, productId: 5, quantity: 1 }),
      );
    });

    it('retries in a fresh transaction on a unique violation', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product());
      cartRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 9, userId: 7 })
        .mockResolvedValueOnce({
          id: 9,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [{ id: 1, cartId: 9, productId: 5, quantity: 1 }],
        });
      cartRepo.save.mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );
      itemRepo.findOne.mockResolvedValue(null);
      itemRepo.count.mockResolvedValue(0);
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      await service.addItem(7, { productId: 5 }, TENANT);

      expect(cartRepo.manager.transaction).toHaveBeenCalledTimes(2);
      expect(cartRepo.save).toHaveBeenCalledTimes(1);
      expect(itemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 9, productId: 5, quantity: 1 }),
      );
    });

    it('rejects a missing product', async () => {
      const { service, productRepo, cartRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.addItem(7, { productId: 5 }, TENANT),
      ).rejects.toThrow(BadRequestException);
      expect(cartRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects an inactive product', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product({ isActive: false }));

      await expect(
        service.addItem(7, { productId: 5 }, TENANT),
      ).rejects.toThrow('Product is not available');
    });

    it('rejects an out-of-stock product', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product({ stock: 0 }));

      await expect(
        service.addItem(7, { productId: 5 }, TENANT),
      ).rejects.toThrow('Product is out of stock');
    });

    it('rejects when the target quantity exceeds stock', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product({ stock: 4 }));
      cartRepo.findOne.mockResolvedValue({ id: 1, userId: 7 });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 3,
      });

      await expect(
        service.addItem(7, { productId: 5, quantity: 2 }, TENANT),
      ).rejects.toThrow('Insufficient stock');
    });

    it('rejects when the target quantity exceeds the per-line maximum', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product({ stock: 1000 }));
      cartRepo.findOne.mockResolvedValue({ id: 1, userId: 7 });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 99,
      });

      await expect(
        service.addItem(7, { productId: 5, quantity: 1 }, TENANT),
      ).rejects.toThrow('Quantity exceeds maximum');
    });

    it('rejects a new line when the cart is full', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue(product({ stock: 1000 }));
      cartRepo.findOne.mockResolvedValue({ id: 1, userId: 7 });
      itemRepo.findOne.mockResolvedValue(null);
      itemRepo.count.mockResolvedValue(MAX_CART_ITEMS);

      await expect(
        service.addItem(7, { productId: 5 }, TENANT),
      ).rejects.toThrow(BadRequestException);
      expect(itemRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('throws 404 when the caller has no cart', async () => {
      const { service, cartRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateItem(7, 5, { quantity: 2 }, TENANT),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when the product is not in the caller cart', async () => {
      const { service, cartRepo, itemRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue({ id: 1, userId: 7 });
      itemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateItem(7, 5, { quantity: 2 }, TENANT),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an increase above available stock', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue({ id: 1, userId: 7 });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 1,
      });
      productRepo.findOneBy.mockResolvedValue(product({ stock: 2 }));

      await expect(
        service.updateItem(7, 5, { quantity: 5 }, TENANT),
      ).rejects.toThrow('Insufficient stock');
      expect(itemRepo.update).not.toHaveBeenCalled();
    });

    it('rejects an increase on an inactive product', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue({ id: 1, userId: 7 });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 1,
      });
      productRepo.findOneBy.mockResolvedValue(
        product({ isActive: false, stock: 10 }),
      );

      await expect(
        service.updateItem(7, 5, { quantity: 2 }, TENANT),
      ).rejects.toThrow('Product is not available');
    });

    it('allows reducing an over-stock line', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      cartRepo.findOne
        .mockResolvedValueOnce({ id: 1, userId: 7 })
        .mockResolvedValueOnce({
          id: 1,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [{ id: 3, cartId: 1, productId: 5, quantity: 3 }],
        });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 5,
      });
      productRepo.findOneBy.mockResolvedValue(product({ stock: 1 }));
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      const result = await service.updateItem(7, 5, { quantity: 3 }, TENANT);

      expect(itemRepo.update).toHaveBeenCalledWith({ id: 3 }, { quantity: 3 });
      expect(result.totalQuantity).toBe(3);
    });

    it('allows reducing an inactive line', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      cartRepo.findOne
        .mockResolvedValueOnce({ id: 1, userId: 7 })
        .mockResolvedValueOnce({
          id: 1,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [{ id: 3, cartId: 1, productId: 5, quantity: 2 }],
        });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 4,
      });
      productRepo.findOneBy.mockResolvedValue(product({ isActive: false }));
      productRepo.find.mockResolvedValue([product({ images: [] })]);

      await service.updateItem(7, 5, { quantity: 2 }, TENANT);

      expect(itemRepo.update).toHaveBeenCalledWith({ id: 3 }, { quantity: 2 });
    });
  });

  describe('removeItem', () => {
    it('throws 404 when the caller has no cart', async () => {
      const { service, cartRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue(null);

      await expect(service.removeItem(7, 5, TENANT)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the line and returns the updated cart', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      cartRepo.findOne
        .mockResolvedValueOnce({ id: 1, userId: 7 })
        .mockResolvedValueOnce({
          id: 1,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [],
        });
      itemRepo.findOne.mockResolvedValue({
        id: 3,
        cartId: 1,
        productId: 5,
        quantity: 2,
      });
      productRepo.find.mockResolvedValue([]);

      const result = await service.removeItem(7, 5, TENANT);

      expect(itemRepo.delete).toHaveBeenCalledWith({ id: 3 });
      expect(result.totalItems).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('returns an empty cart without writing when none exists', async () => {
      const { service, cartRepo, itemRepo } = buildMocks();
      cartRepo.findOne.mockResolvedValue(null);

      const result = await service.clearCart(7, TENANT);

      expect(result.items).toEqual([]);
      expect(itemRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes lines but keeps the cart row', async () => {
      const { service, cartRepo, itemRepo, productRepo } = buildMocks();
      cartRepo.findOne
        .mockResolvedValueOnce({ id: 1, userId: 7 })
        .mockResolvedValueOnce({
          id: 1,
          userId: 7,
          createdAt: NOW,
          updatedAt: NOW,
          items: [],
        });
      productRepo.find.mockResolvedValue([]);

      const result = await service.clearCart(7, TENANT);

      expect(itemRepo.delete).toHaveBeenCalledWith({ cartId: 1 });
      expect(cartRepo.delete).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 1, totalItems: 0, totalQuantity: 0 });
    });
  });
});
