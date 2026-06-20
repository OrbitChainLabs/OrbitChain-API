import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { DonationsService } from '../donations/donations.service';

jest.mock('./campaigns.service', () => ({
  CampaignsService: class CampaignsService {},
}));

jest.mock('../donations/donations.service', () => ({
  DonationsService: class DonationsService {},
}));

jest.mock('../auth/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../common/guards/roles.guard', () => ({
  RolesGuard: class RolesGuard {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../users/guards/admin.guard', () => ({
  AdminGuard: class AdminGuard {
    canActivate() {
      return true;
    }
  },
}));

describe('CampaignsController browseCampaigns cache keying', () => {
  let controller: CampaignsController;
  const campaignsService = {
    browseCampaigns: jest.fn(),
  };
  const cacheStore = new Map<string, unknown>();
  const cacheManager = {
    get: jest.fn(async (key: string) => cacheStore.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
    }),
  };

  beforeEach(async () => {
    cacheStore.clear();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [
        { provide: CampaignsService, useValue: campaignsService },
        { provide: DonationsService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    controller = module.get(CampaignsController);
  });

  it('creates distinct cached entries for different page and sortBy values', async () => {
    campaignsService.browseCampaigns.mockImplementation(
      async (query: { page: number; limit: number; sortBy: string }) => ({
        data: [{ id: `${query.sortBy}-${query.page}` }],
        total: 2,
        page: query.page,
        limit: query.limit,
      }),
    );

    const first = await controller.browseCampaigns({
      category: 'health',
      status: 'ACTIVE',
      search: 'solar',
      page: 1,
      limit: 10,
      sortBy: 'newest',
    });

    const second = await controller.browseCampaigns({
      category: 'health',
      status: 'ACTIVE',
      search: 'solar',
      page: 2,
      limit: 10,
      sortBy: 'newest',
    });

    const third = await controller.browseCampaigns({
      category: 'health',
      status: 'ACTIVE',
      search: 'solar',
      page: 1,
      limit: 10,
      sortBy: 'mostFunded',
    });

    expect(first).toEqual({
      data: [{ id: 'newest-1' }],
      total: 2,
      page: 1,
      limit: 10,
    });
    expect(second).toEqual({
      data: [{ id: 'newest-2' }],
      total: 2,
      page: 2,
      limit: 10,
    });
    expect(third).toEqual({
      data: [{ id: 'mostFunded-1' }],
      total: 2,
      page: 1,
      limit: 10,
    });

    expect(campaignsService.browseCampaigns).toHaveBeenCalledTimes(3);

    const cacheKeys = cacheManager.set.mock.calls.map(([key]) => key as string);
    expect(cacheKeys).toHaveLength(3);
    expect(new Set(cacheKeys).size).toBe(3);
  });

  it('hashes long search queries to keep cache keys compact', async () => {
    campaignsService.browseCampaigns.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    await controller.browseCampaigns({
      search: 'x'.repeat(300),
      page: 1,
      limit: 10,
      sortBy: 'newest',
    });

    const [cacheKey] = cacheManager.set.mock.calls[0];
    expect(cacheKey).toMatch(/^campaigns:[a-f0-9]{64}$/);
  });
});
