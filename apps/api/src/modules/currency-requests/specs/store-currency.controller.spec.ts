import { Test } from '@nestjs/testing';
import { StoreCurrencyController } from '../store-currency.controller';
import { CurrencyRequestsService } from '../currency-requests.service';
import { CreateCurrencyChangeRequestDto } from '../dto/create-currency-change-request.dto';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { Currency } from '../../../common/constants/currency.enum';

const mockCurrencyRequestsService = {
  getForTenant: jest.fn(),
  create: jest.fn(),
  cancel: jest.fn(),
};

const makeRequest = (
  overrides: Partial<RequestWithUser> = {},
): RequestWithUser =>
  ({
    user: { id: 1, email: 'owner@test.dev' },
    tenant: { id: 1, schemaName: 'tenant_test' },
    ...overrides,
  }) as RequestWithUser;

describe('StoreCurrencyController', () => {
  let controller: StoreCurrencyController;
  let service: typeof mockCurrencyRequestsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StoreCurrencyController],
      providers: [
        {
          provide: CurrencyRequestsService,
          useValue: mockCurrencyRequestsService,
        },
      ],
    }).compile();

    controller = moduleRef.get(StoreCurrencyController);
    service = moduleRef.get(CurrencyRequestsService);
    jest.clearAllMocks();
  });

  describe('getCurrency', () => {
    it('delegates to CurrencyRequestsService.getForTenant with tenant', async () => {
      const req = makeRequest();
      const expected = { currency: 'USD', pendingRequest: null };
      service.getForTenant.mockResolvedValue(expected);

      const result = await controller.getCurrency(req);

      expect(service.getForTenant).toHaveBeenCalledWith(req.tenant!);
      expect(result).toEqual(expected);
    });
  });

  describe('createRequest', () => {
    it('delegates to CurrencyRequestsService.create with tenant, requester, and dto', async () => {
      const req = makeRequest();
      const dto: CreateCurrencyChangeRequestDto = {
        requestedCurrency: Currency.EUR,
        reason: 'European customers',
      };
      const expected = {
        id: 1,
        tenantId: 1,
        requestedCurrency: Currency.EUR,
        status: 'PENDING',
      };
      service.create.mockResolvedValue(expected);

      const result = await controller.createRequest(req, dto);

      expect(service.create).toHaveBeenCalledWith(
        req.tenant!,
        { id: req.user.id, email: req.user.email },
        dto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('cancelRequest', () => {
    it('delegates to CurrencyRequestsService.cancel with tenant and id', async () => {
      const req = makeRequest();
      const expected = { id: 1, status: 'CANCELLED' };
      service.cancel.mockResolvedValue(expected);

      const result = await controller.cancelRequest(req, 1);

      expect(service.cancel).toHaveBeenCalledWith(req.tenant!, 1);
      expect(result).toEqual(expected);
    });
  });
});
