import { BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService milestone target validation', () => {
  const prisma = {
    campaign: {
      create: jest.fn(),
    },
  };

  let service: CampaignsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CampaignsService(prisma as any, {} as any);
  });

  const baseDto = {
    title: 'Orbit funding round',
    goalAmount: '100',
  };

  it.each([
    ['missing', undefined],
    ['zero', '0'],
    ['zero decimal', '0.0000000'],
    ['below the minimum precision', '0.00000001'],
    ['negative', '-1'],
    ['not numeric', 'abc'],
  ])('rejects a %s milestone targetAmount', async (_case, targetAmount) => {
    await expect(
      service.createCampaign('user-1', {
        ...baseDto,
        milestones: [
          {
            title: 'Prototype',
            targetAmount,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.campaign.create).not.toHaveBeenCalled();
  });

  it('passes a valid positive milestone targetAmount through to Prisma', async () => {
    prisma.campaign.create.mockResolvedValue({ id: 'campaign-1' });

    await service.createCampaign('user-1', {
      ...baseDto,
      milestones: [
        {
          title: 'Prototype',
          targetAmount: '0.0000001',
        },
      ],
    });

    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          milestones: {
            create: [
              expect.objectContaining({
                targetAmount: '0.0000001',
              }),
            ],
          },
        }),
      }),
    );
  });
});

import { NotFoundException } from '@nestjs/common';

type Balance = {
  assetCode: string;
  assetIssuer?: string;
  balance: string;
  isNative: boolean;
};

const createService = ({
  campaign,
  balances,
  releases,
}: {
  campaign: any;
  balances: Balance[];
  releases: Array<{ amount: string | number }>;
}) => {
  const prisma: any = {
    campaign: {
      findUnique: jest.fn().mockResolvedValue(campaign),
      update: jest.fn(),
    },
    fundRelease: {
      findMany: jest.fn().mockResolvedValue(releases),
    },
  };

  const stellarTransactions: any = {
    getContractBalances: jest.fn().mockResolvedValue(balances),
  };

  const service = new CampaignsService(prisma, stellarTransactions);
  return { service, prisma, stellarTransactions };
};

describe('CampaignsService.getContractBalance safety fixes (issue #1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundException when the campaign does not exist', async () => {
    const { service } = createService({
      campaign: null,
      balances: [],
      releases: [],
    });
    await expect(service.getContractBalance('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws BadRequestException when the campaign has no contractId', async () => {
    const { service } = createService({
      campaign: { id: 'c1', contractId: null, raisedAmount: 0 },
      balances: [],
      releases: [],
    });
    await expect(service.getContractBalance('c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('XLM-only case: a single native balance matching the stored amount reports NO discrepancy', async () => {
    const { service, prisma } = createService({
      campaign: { id: 'c1', contractId: 'CONTRACT', raisedAmount: 100 },
      balances: [
        { assetCode: 'XLM', balance: '100', isNative: true },
      ],
      releases: [],
    });

    const report = await service.getContractBalance('c1');

    expect(report.discrepancyDetected).toBe(false);
    expect(report.netAvailableByAssetTotal).toBe('100');
    expect(report.netReleasedAmount).toBe('0');
    expect(report.onChainTotal).toBe('100');
    expect(report.perAsset).toHaveLength(1);
    expect(report.perAsset[0]).toMatchObject({
      assetCode: 'XLM',
      isNative: true,
      grossOnChain: '100',
      released: '0',
      netAvailable: '100',
    });
    // The fix to issue #1: never silently write raisedAmount.
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('multi-asset case: an issued-asset balance is NOT mixed into the XLM counter', async () => {
    // 50 XLM on-chain + 1_000 of an issued credit asset. If the buggy
    // implementation summed numerically, netAvailableByAssetTotal would
    // equal 1050 and the discrepancy flag would be wrong. The fix keeps
    // XLM as the canonical XLM-denominated figure (Campaign.raisedAmount
    // is XLM-denominated), so USDC appears in `perAsset` but does NOT
    // fold into the canonical total.
    const { service, prisma } = createService({
      campaign: { id: 'c2', contractId: 'CONTRACT', raisedAmount: 80 },
      balances: [
        { assetCode: 'XLM', balance: '50', isNative: true },
        {
          assetCode: 'USDC',
          assetIssuer: 'G-ISSUER',
          balance: '1000',
          isNative: false,
        },
      ],
      releases: [],
    });

    const report = await service.getContractBalance('c2');

    // XLM-only net figure is 50 vs stored 80 -> discrepancy, but the
    // service MUST NOT silently write. The audit-gated write lives in
    // AdminService.reconcileCampaignBalance, not here.
    expect(report.discrepancyDetected).toBe(true);
    expect(report.netAvailableByAssetTotal).toBe('50');
    expect(report.onChainTotal).toBe('50');
    expect(report.perAsset).toHaveLength(2);

    const xlm = report.perAsset.find((p) => p.isNative);
    const usdc = report.perAsset.find((p) => !p.isNative);
    expect(xlm).toMatchObject({
      assetCode: 'XLM',
      grossOnChain: '50',
      released: '0',
      netAvailable: '50',
    });
    expect(usdc).toMatchObject({
      assetCode: 'USDC',
      assetIssuer: 'G-ISSUER',
      grossOnChain: '1000',
      released: '0',
      netAvailable: '1000',
    });

    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('post-release netted case: stored raisedAmount equals on-chain + APPROVED/RELEASED outflows', async () => {
    // Campaign has 15 XLM of `raisedAmount` recorded in the DB. The contract
    // account currently holds 10 XLM (5 XLM drained via an APPROVED release).
    // naive on-chain comparison would flag this as a discrepancy; the fix
    // nets against approved/released fund releases so 10 + 5 == 15.
    const { service, prisma } = createService({
      campaign: { id: 'c3', contractId: 'CONTRACT', raisedAmount: 15 },
      balances: [
        { assetCode: 'XLM', balance: '10', isNative: true },
      ],
      releases: [{ amount: 5 }],
    });

    const report = await service.getContractBalance('c3');

    expect(report.discrepancyDetected).toBe(false);
    expect(report.onChainTotal).toBe('10');
    expect(report.netReleasedAmount).toBe('5');
    expect(report.netAvailableByAssetTotal).toBe('15');
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('releases that exceed on-chain holdings surface a discrepancy even after netting', async () => {
    // Without any on-chain balance but with a prior APPROVED release of 5
    // XLM, the canonical net is 0 + 5 = 5 while stored is 10. The flag
    // surfaces the case for an admin override. The service still does not
    // write to the DB.
    const { service, prisma } = createService({
      campaign: { id: 'c4', contractId: 'CONTRACT', raisedAmount: 10 },
      balances: [{ assetCode: 'XLM', balance: '0', isNative: true }],
      releases: [{ amount: 5 }],
    });

    const report = await service.getContractBalance('c4');

    expect(report.netAvailableByAssetTotal).toBe('5');
    expect(report.netReleasedAmount).toBe('5');
    expect(report.discrepancyDetected).toBe(true);
    expect(report.storedRaisedAmount).toBe('10');
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('refuses to silently write raisedAmount when the figures diverge', async () => {
    const { service, prisma } = createService({
      campaign: { id: 'c5', contractId: 'CONTRACT', raisedAmount: 9999 },
      balances: [{ assetCode: 'XLM', balance: '5', isNative: true }],
      releases: [],
    });

    const report = await service.getContractBalance('c5');

    expect(report.discrepancyDetected).toBe(true);
    expect(report.netAvailableByAssetTotal).toBe('5');
    expect(report.storedRaisedAmount).toBe('9999');
    // The critical fix: this method must NEVER write to the DB.
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });
});
