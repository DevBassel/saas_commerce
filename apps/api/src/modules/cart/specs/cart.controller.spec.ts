import { Test } from '@nestjs/testing';
import { CartController } from '../cart.controller';
import { CartService } from '../cart.service';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { CartPermissionKey } from '../constants/cart-permissions.enum';

const mockCartService = {
  getCart: jest.fn(),
  addItem: jest.fn(),
  updateItem: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: {
      id: 1,
      email: 'test@test.dev',
      permissions: [
        CartPermissionKey.READ,
        CartPermissionKey.CREATE,
        CartPermissionKey.UPDATE,
        CartPermissionKey.DELETE,
      ],
    },
    ...overrides,
  }) as RequestWithUser;

describe('CartController', () => {
  let controller: CartController;
  let cartService: typeof mockCartService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    }).compile();

    controller = moduleRef.get(CartController);
    cartService = moduleRef.get(CartService);
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('delegates to CartService.getCart with user id', async () => {
      const req = makeRequest();
      const expected = { id: 1, userId: 1, items: [], subtotal: 0 };
      cartService.getCart.mockResolvedValue(expected);

      const result = await controller.getCart(req);

      expect(cartService.getCart).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('addItem', () => {
    it('delegates to CartService.addItem with user id and dto', async () => {
      const req = makeRequest();
      const dto: AddCartItemDto = { productId: 5, quantity: 2 };
      const expected = {
        id: 1,
        userId: 1,
        items: [{ productId: 5, quantity: 2 }],
      };
      cartService.addItem.mockResolvedValue(expected);

      const result = await controller.addItem(req, dto);

      expect(cartService.addItem).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('updateItem', () => {
    it('delegates to CartService.updateItem with user id, product id, and dto', async () => {
      const req = makeRequest();
      const dto: UpdateCartItemDto = { quantity: 3 };
      const expected = {
        id: 1,
        userId: 1,
        items: [{ productId: 5, quantity: 3 }],
      };
      cartService.updateItem.mockResolvedValue(expected);

      const result = await controller.updateItem(req, 5, dto);

      expect(cartService.updateItem).toHaveBeenCalledWith(1, 5, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('removeItem', () => {
    it('delegates to CartService.removeItem with user id and product id', async () => {
      const req = makeRequest();
      const expected = { id: 1, userId: 1, items: [] };
      cartService.removeItem.mockResolvedValue(expected);

      const result = await controller.removeItem(req, 5);

      expect(cartService.removeItem).toHaveBeenCalledWith(1, 5);
      expect(result).toEqual(expected);
    });
  });

  describe('clearCart', () => {
    it('delegates to CartService.clearCart with user id', async () => {
      const req = makeRequest();
      const expected = { id: 1, userId: 1, items: [] };
      cartService.clearCart.mockResolvedValue(expected);

      const result = await controller.clearCart(req);

      expect(cartService.clearCart).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });
});
