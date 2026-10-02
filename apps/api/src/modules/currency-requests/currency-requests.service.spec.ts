import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CurrencyRequestsService } from './currency-requests.service';
import { CurrencyChangeRequestStatus } from './enums/currency-change-request-status.enum';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantService } from '../tenants/tenant.service';

const TENANT = {
  id: 7,
  name: 'My Store',
  slug: 'my-store',
  currency: 'usd',
} as Tenant;

const ACTOR = { id: 42, email: 'owner@example.com' };

const buildMocks = () => {
  const requestRepo = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data: Record<string, unknown>) => data),
  };
  const tenantService = {
    updateCurrency: jest.fn(),
    findAll: jest.fn(),
  };

  const service = new CurrencyRequestsService(
    requestRepo as never,
    tenantService as unknown as TenantService,
  );
  return { service, requestRepo, tenantService };
};

describe('CurrencyRequestsService', () => {
  it('rejects a request matching the current currency', async () => {
    const { service, requestRepo } = buildMocks();

    await expect(
      service.create(TENANT, ACTOR, { requestedCurrency: 'usd' as never }),
    ).rejects.toThrow(BadRequestException);
    expect(requestRepo.findOne).not.toHaveBeenCalled();
  });

  it('rejects a second pending request for the same tenant', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOne.mockResolvedValue({
      id: 1,
      status: CurrencyChangeRequestStatus.PENDING,
    });

    await expect(
      service.create(TENANT, ACTOR, { requestedCurrency: 'eur' as never }),
    ).rejects.toThrow(ConflictException);
    expect(requestRepo.save).not.toHaveBeenCalled();
  });

  it('creates a pending request with a snapshot of the requester', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOne.mockResolvedValue(null);
    requestRepo.save.mockImplementation((data: Record<string, unknown>) => ({
      id: 5,
      ...data,
    }));

    const result = await service.create(TENANT, ACTOR, {
      requestedCurrency: 'eur' as never,
      reason: 'EU customers',
    });

    expect(requestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 7,
        requestedById: 42,
        requestedByEmail: 'owner@example.com',
        currentCurrency: 'usd',
        requestedCurrency: 'eur',
        status: CurrencyChangeRequestStatus.PENDING,
        reason: 'EU customers',
      }),
    );
    expect(result).toMatchObject({ id: 5, status: 'PENDING' });
  });

  it('maps a unique violation on the single-pending index to a conflict', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOne.mockResolvedValue(null);
    requestRepo.save.mockRejectedValue({ code: '23505' });

    await expect(
      service.create(TENANT, ACTOR, { requestedCurrency: 'eur' as never }),
    ).rejects.toThrow(ConflictException);
  });

  it('cancels only the tenant own pending request', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 9,
      tenantId: 7,
      status: CurrencyChangeRequestStatus.PENDING,
    });
    requestRepo.save.mockImplementation((data: unknown) => data);

    const result = await service.cancel(TENANT, 9);
    expect(result).toMatchObject({
      id: 9,
      status: CurrencyChangeRequestStatus.CANCELLED,
    });
  });

  it('does not cancel another tenant request', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 9,
      tenantId: 99,
      status: CurrencyChangeRequestStatus.PENDING,
    });

    await expect(service.cancel(TENANT, 9)).rejects.toThrow(NotFoundException);
    expect(requestRepo.save).not.toHaveBeenCalled();
  });

  it('does not cancel a reviewed request', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 9,
      tenantId: 7,
      status: CurrencyChangeRequestStatus.APPROVED,
    });

    await expect(service.cancel(TENANT, 9)).rejects.toThrow(ConflictException);
  });

  it('approves a pending request and updates the tenant currency', async () => {
    const { service, requestRepo, tenantService } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 3,
      tenantId: 7,
      status: CurrencyChangeRequestStatus.PENDING,
      requestedCurrency: 'eur',
    });
    requestRepo.save.mockImplementation((data: unknown) => data);

    const result = await service.approve(3, 88);

    expect(tenantService.updateCurrency).toHaveBeenCalledWith(7, 'eur');
    expect(result).toMatchObject({
      status: CurrencyChangeRequestStatus.APPROVED,
      reviewedById: 88,
    });
  });

  it('requires a review note when rejecting', async () => {
    const { service, requestRepo } = buildMocks();

    await expect(service.reject(3, 88, { reviewNote: '   ' })).rejects.toThrow(
      BadRequestException,
    );
    expect(requestRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('rejects a pending request with the trimmed note', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 3,
      tenantId: 7,
      status: CurrencyChangeRequestStatus.PENDING,
    });
    requestRepo.save.mockImplementation((data: unknown) => data);

    const result = await service.reject(3, 88, { reviewNote: '  Not now  ' });

    expect(result).toMatchObject({
      status: CurrencyChangeRequestStatus.REJECTED,
      reviewNote: 'Not now',
      reviewedById: 88,
    });
  });

  it('returns current currency, pending request, and recent history for a tenant', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOne.mockResolvedValue({
      id: 5,
      status: CurrencyChangeRequestStatus.PENDING,
    });
    requestRepo.find.mockResolvedValue([{ id: 5 }]);

    const result = await service.getForTenant(TENANT);

    expect(requestRepo.findOne).toHaveBeenCalledWith({
      where: {
        tenantId: 7,
        status: CurrencyChangeRequestStatus.PENDING,
      },
    });
    expect(requestRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 7 },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    expect(result).toEqual({
      currency: 'usd',
      pendingRequest: {
        id: 5,
        status: CurrencyChangeRequestStatus.PENDING,
      },
      history: [{ id: 5 }],
    });
  });

  it('lists requests filtered by status and attaches the owning tenant summary', async () => {
    const { service, requestRepo, tenantService } = buildMocks();
    requestRepo.find.mockResolvedValue([
      { id: 1, tenantId: 7 },
      { id: 2, tenantId: 99 },
    ]);
    tenantService.findAll.mockResolvedValue([TENANT]);

    const result = await service.list(CurrencyChangeRequestStatus.PENDING);

    expect(requestRepo.find).toHaveBeenCalledWith({
      where: { status: CurrencyChangeRequestStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    expect(result[0]).toMatchObject({
      id: 1,
      tenant: { name: 'My Store', slug: 'my-store', currency: 'usd' },
    });
    expect(result[1]).toMatchObject({ id: 2, tenant: null });
  });

  it('lists every request when no status filter is provided', async () => {
    const { service, requestRepo, tenantService } = buildMocks();
    requestRepo.find.mockResolvedValue([]);
    tenantService.findAll.mockResolvedValue([]);

    await service.list();

    expect(requestRepo.find).toHaveBeenCalledWith({
      where: {},
      order: { createdAt: 'DESC' },
    });
  });

  it('rethrows non-unique save failures on create', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOne.mockResolvedValue(null);
    const failure = new Error('db down');
    requestRepo.save.mockRejectedValue(failure);

    await expect(
      service.create(TENANT, ACTOR, { requestedCurrency: 'eur' as never }),
    ).rejects.toBe(failure);
  });

  it('maps a nested driverError unique violation to a conflict', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOne.mockResolvedValue(null);
    requestRepo.save.mockRejectedValue({ driverError: { code: '23505' } });

    await expect(
      service.create(TENANT, ACTOR, { requestedCurrency: 'eur' as never }),
    ).rejects.toThrow(ConflictException);
  });

  it('defaults an omitted reason to null', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOne.mockResolvedValue(null);
    requestRepo.save.mockImplementation((data: unknown) => data);

    await service.create(TENANT, ACTOR, { requestedCurrency: 'eur' as never });

    expect(requestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: null }),
    );
  });

  it('throws 404 when cancelling a missing request', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue(null);

    await expect(service.cancel(TENANT, 9)).rejects.toThrow(NotFoundException);
    expect(requestRepo.save).not.toHaveBeenCalled();
  });

  it('throws 404 when approving a missing request', async () => {
    const { service, requestRepo, tenantService } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue(null);

    await expect(service.approve(3, 88)).rejects.toThrow(NotFoundException);
    expect(tenantService.updateCurrency).not.toHaveBeenCalled();
  });

  it('throws conflict when approving an already reviewed request', async () => {
    const { service, requestRepo, tenantService } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 3,
      tenantId: 7,
      status: CurrencyChangeRequestStatus.APPROVED,
    });

    await expect(service.approve(3, 88)).rejects.toThrow(ConflictException);
    expect(tenantService.updateCurrency).not.toHaveBeenCalled();
  });

  it('throws 404 when rejecting a missing request', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue(null);

    await expect(service.reject(3, 88, { reviewNote: 'no' })).rejects.toThrow(
      NotFoundException,
    );
    expect(requestRepo.save).not.toHaveBeenCalled();
  });

  it('throws conflict when rejecting an already reviewed request', async () => {
    const { service, requestRepo } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 3,
      tenantId: 7,
      status: CurrencyChangeRequestStatus.CANCELLED,
    });

    await expect(service.reject(3, 88, { reviewNote: 'no' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('does not touch the tenant currency when rejecting', async () => {
    const { service, requestRepo, tenantService } = buildMocks();
    requestRepo.findOneBy.mockResolvedValue({
      id: 3,
      tenantId: 7,
      status: CurrencyChangeRequestStatus.PENDING,
    });
    requestRepo.save.mockImplementation((data: unknown) => data);

    await service.reject(3, 88, { reviewNote: 'no' });

    expect(tenantService.updateCurrency).not.toHaveBeenCalled();
  });
});
