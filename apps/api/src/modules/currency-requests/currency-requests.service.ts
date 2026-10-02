import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantService } from '../tenants/tenant.service';
import { CurrencyChangeRequest } from './entities/currency-change-request.entity';
import { CurrencyChangeRequestStatus } from './enums/currency-change-request-status.enum';
import { CreateCurrencyChangeRequestDto } from './dto/create-currency-change-request.dto';
import { ReviewCurrencyChangeRequestDto } from './dto/review-currency-change-request.dto';
import { isUniqueViolation } from '../../common/db/unique-retry';

export interface RequestActor {
  id: number;
  email: string;
}

const PENDING_REQUEST_EXISTS =
  'A pending currency change request already exists for this store';

@Injectable()
export class CurrencyRequestsService {
  constructor(
    @InjectRepository(CurrencyChangeRequest)
    private readonly requestRepo: Repository<CurrencyChangeRequest>,
    private readonly tenantService: TenantService,
  ) {}

  async getForTenant(tenant: Tenant) {
    const [pendingRequest, history] = await Promise.all([
      this.findPendingForTenant(tenant.id),
      this.requestRepo.find({
        where: { tenantId: tenant.id },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);
    return {
      currency: tenant.currency,
      pendingRequest,
      history,
    };
  }

  async findPendingForTenant(tenantId: number) {
    return this.requestRepo.findOne({
      where: { tenantId, status: CurrencyChangeRequestStatus.PENDING },
    });
  }

  async create(
    tenant: Tenant,
    actor: RequestActor,
    dto: CreateCurrencyChangeRequestDto,
  ) {
    if (String(dto.requestedCurrency) === tenant.currency) {
      throw new BadRequestException(
        'Requested currency matches the current store currency',
      );
    }

    const pending = await this.findPendingForTenant(tenant.id);
    if (pending) {
      throw new ConflictException(PENDING_REQUEST_EXISTS);
    }

    try {
      return await this.requestRepo.save(
        this.requestRepo.create({
          tenantId: tenant.id,
          requestedById: actor.id,
          requestedByEmail: actor.email,
          currentCurrency: tenant.currency,
          requestedCurrency: dto.requestedCurrency,
          status: CurrencyChangeRequestStatus.PENDING,
          reason: dto.reason ?? null,
          reviewNote: null,
          reviewedById: null,
          reviewedAt: null,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(PENDING_REQUEST_EXISTS);
      }
      throw error;
    }
  }

  async cancel(tenant: Tenant, requestId: number) {
    const request = await this.requestRepo.findOneBy({ id: requestId });
    if (!request || request.tenantId !== tenant.id) {
      throw new NotFoundException('Currency change request not found');
    }
    if (request.status !== CurrencyChangeRequestStatus.PENDING) {
      throw new ConflictException('Only pending requests can be cancelled');
    }
    request.status = CurrencyChangeRequestStatus.CANCELLED;
    return this.requestRepo.save(request);
  }

  async list(status?: CurrencyChangeRequestStatus) {
    const requests = await this.requestRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });

    const tenants = await this.tenantService.findAll();
    const byId = new Map(tenants.map((tenant) => [tenant.id, tenant]));

    return requests.map((request) => {
      const tenant = byId.get(request.tenantId);
      return {
        ...request,
        tenant: tenant
          ? { name: tenant.name, slug: tenant.slug, currency: tenant.currency }
          : null,
      };
    });
  }

  async approve(requestId: number, reviewerId: number) {
    const request = await this.requirePending(requestId);
    await this.tenantService.updateCurrency(
      request.tenantId,
      request.requestedCurrency,
    );
    request.status = CurrencyChangeRequestStatus.APPROVED;
    request.reviewedById = reviewerId;
    request.reviewedAt = new Date();
    return this.requestRepo.save(request);
  }

  async reject(
    requestId: number,
    reviewerId: number,
    dto: ReviewCurrencyChangeRequestDto,
  ) {
    const reviewNote = dto.reviewNote?.trim();
    if (!reviewNote) {
      throw new BadRequestException('reviewNote is required when rejecting');
    }
    const request = await this.requirePending(requestId);
    request.status = CurrencyChangeRequestStatus.REJECTED;
    request.reviewNote = reviewNote;
    request.reviewedById = reviewerId;
    request.reviewedAt = new Date();
    return this.requestRepo.save(request);
  }

  private async requirePending(requestId: number) {
    const request = await this.requestRepo.findOneBy({ id: requestId });
    if (!request) {
      throw new NotFoundException('Currency change request not found');
    }
    if (request.status !== CurrencyChangeRequestStatus.PENDING) {
      throw new ConflictException('Request has already been reviewed');
    }
    return request;
  }
}
