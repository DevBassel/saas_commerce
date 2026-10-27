import { Test } from '@nestjs/testing';
import { CategoriesController } from '../categories.controller';
import { CategoriesService } from '../categories.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryPermissionKey } from '../constants/category-permissions.enum';

const mockCategoriesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  findStorefrontOptions: jest.fn(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: typeof mockCategoriesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = moduleRef.get(CategoriesController);
    categoriesService = moduleRef.get(CategoriesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to CategoriesService.findAll', async () => {
      const expected = [{ id: 1, name: 'Category 1', slug: 'cat-1' }];
      categoriesService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(categoriesService.findAll).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('delegates to CategoriesService.findOne with id', async () => {
      const expected = { id: 1, name: 'Category 1', slug: 'cat-1' };
      categoriesService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(1);

      expect(categoriesService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to CategoriesService.create with dto', async () => {
      const dto: CreateCategoryDto = {
        name: 'New Category',
        description: 'Description',
      };
      const expected = {
        id: 2,
        name: 'New Category',
        slug: 'new-category',
        description: 'Description',
      };
      categoriesService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(categoriesService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to CategoriesService.update with id and dto', async () => {
      const dto: UpdateCategoryDto = { name: 'Updated Category' };
      const expected = {
        id: 1,
        name: 'Updated Category',
        slug: 'updated-category',
      };
      categoriesService.update.mockResolvedValue(expected);

      const result = await controller.update(1, dto);

      expect(categoriesService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('delegates to CategoriesService.remove with id', async () => {
      const expected = { deleted: true };
      categoriesService.remove.mockResolvedValue(expected);

      const result = await controller.remove(1);

      expect(categoriesService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });
});
