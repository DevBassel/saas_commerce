import { Test } from '@nestjs/testing';
import { PlatformSubscriptionPlansController } from '../../controllers/platform-subscription-plans.controller';
import { SubscriptionPlansService } from '../../services/subscription-plans.service';
import { CreateSubscriptionPlanDto } from '../../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../../dto/update-subscription-plan.dto';
import { ListSubscriptionPlansQueryDto } from '../../dto/list-subscription-plans.query.dto';
import { SubscriptionLimitKey } from '../../constants/subscription-limit-key.enum';
import { LimitValueType } from '../../constants/limit-value-type.enum';

const mockPlansService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('PlatformSubscriptionPlansController', () => {
  let controller: PlatformSubscriptionPlansController;
  let plansService: typeof mockPlansService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformSubscriptionPlansController],
      providers: [
        { provide: SubscriptionPlansService, useValue: mockPlansService },
      ],
    }).compile();

    controller = moduleRef.get(PlatformSubscriptionPlansController);
    plansService = moduleRef.get(SubscriptionPlansService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to SubscriptionPlansService.findAll with query', async () => {
      const query: ListSubscriptionPlansQueryDto = {
        page: 1,
        limit: 10,
        active: true,
      };
      const expected = {
        data: [{ id: 1, name: 'Free' }],
        total: 1,
        page: 1,
        limit: 10,
      };
      plansService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(plansService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('delegates to SubscriptionPlansService.findOne with id', async () => {
      const expected = { id: 1, name: 'Free', slug: 'free', active: true };
      plansService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(1);

      expect(plansService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to SubscriptionPlansService.create with dto', async () => {
      const dto: CreateSubscriptionPlanDto = {
        name: 'New Plan',
        slug: 'new-plan',
        limits: [
          {
            key: SubscriptionLimitKey.STORAGE_BYTES,
            value: 1000000,
            type: LimitValueType.BYTES,
          },
        ],
      };
      const expected = { id: 2, name: 'New Plan', slug: 'new-plan' };
      plansService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(plansService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to SubscriptionPlansService.update with id and dto', async () => {
      const dto: UpdateSubscriptionPlanDto = { name: 'Updated Plan' };
      const expected = { id: 1, name: 'Updated Plan' };
      plansService.update.mockResolvedValue(expected);

      const result = await controller.update(1, dto);

      expect(plansService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('delegates to SubscriptionPlansService.remove with id', async () => {
      const expected = { deactivated: true };
      plansService.remove.mockResolvedValue(expected);

      const result = await controller.remove(1);

      expect(plansService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });
});
