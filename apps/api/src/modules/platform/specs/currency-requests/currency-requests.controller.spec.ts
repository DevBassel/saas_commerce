import { Test } from '@nestjs/testing';
import { PlatformCurrencyRequestsController } from '../../currency-requests/currency-requests.controller';
import { CurrencyRequestsService } from '../../../currency-requests/currency-requests.service';
import { ListCurrencyChangeRequestsDto } from '../../../currency-requests/dto/list-currency-change-requests.dto';
import { ReviewCurrencyChangeRequestDto } from '../../../currency-requests/dto/review-currency-change-request.dto';
import type { RequestWithUser } from '../../../auth/interfaces/RequestWithUser.interface';
import { CurrencyChangeRequestStatus } from '../../../currency-requests/enums/currency-change-request-status.enum';

const mockCurrencyRequestsService = {
  list: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: { id: 1, email: 'admin@platform.dev' },
    ...overrides,
  }) as RequestWithUser;

describe('PlatformCurrencyRequestsController', () => {
  let controller: PlatformCurrencyRequestsController;
  let service: typeof mockCurrencyRequestsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformCurrencyRequestsController],
      providers: [
        {
          provide: CurrencyRequestsService,
          useValue: mockCurrencyRequestsService,
        },
      ],
    }).compile();

    controller = moduleRef.get(PlatformCurrencyRequestsController);
    service = moduleRef.get(CurrencyRequestsService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('delegates to CurrencyRequestsService.list with status filter', async () => {
      const query: ListCurrencyChangeRequestsDto = {
        status: CurrencyChangeRequestStatus.PENDING,
      };
      const expected = [
        {
          id: 1,
          tenantId: 1,
          requestedCurrency: 'EUR',
          status: CurrencyChangeRequestStatus.PENDING,
        },
      ];
      service.list.mockResolvedValue(expected);

      const result = await controller.list(query);

      expect(service.list).toHaveBeenCalledWith(query.status);
      expect(result).toEqual(expected);
    });

    it('calls list without status when not provided', async () => {
      const expected = [{ id: 1 }, { id: 2 }];
      service.list.mockResolvedValue(expected);

      const result = await controller.list({});

      expect(service.list).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('approve', () => {
    it('delegates to CurrencyRequestsService.approve with id and reviewer id', async () => {
      const req = makeRequest();
      const expected = { id: 1, status: CurrencyChangeRequestStatus.APPROVED };
      service.approve.mockResolvedValue(expected);

      const result = await controller.approve(req, 1);

      expect(service.approve).toHaveBeenCalledWith(1, req.user.id);
      expect(result).toEqual(expected);
    });
  });

  describe('reject', () => {
    it('delegates to CurrencyRequestsService.reject with id, reviewer id, and dto', async () => {
      const req = makeRequest();
      const dto: ReviewCurrencyChangeRequestDto = {
        reviewNote: 'Not justified',
      };
      const expected = { id: 1, status: CurrencyChangeRequestStatus.REJECTED };
      service.reject.mockResolvedValue(expected);

      const result = await controller.reject(req, 1, dto);

      expect(service.reject).toHaveBeenCalledWith(1, req.user.id, dto);
      expect(result).toEqual(expected);
    });
  });
});
