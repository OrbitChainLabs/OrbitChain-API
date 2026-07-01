import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import { StellarTransactionsService } from '../stellar/stellar-transactions.service';

describe('CampaignsService.updateCampaign (access control)', () => {
  let service: CampaignsService;
  let prisma: {
    campaign: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const OWNER_ID = 'wallet-b-user-id';
  const ATTACKER_ID = 'wallet-a-user-id';
  const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';

  const existingCampaign = {
    id: CAMPAIGN_ID,
    title: 'Original title',
    description: 'Original description',
    story: 'Original story',
    imageUrl: 'https://cdn.example.com/original.png',
    creatorId: OWNER_ID,
  };

  beforeEach(async () => {
    prisma = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue(existingCampaign),
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ ...existingCampaign, ...data })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StellarTransactionsService, useValue: {} },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('throws NotFoundException when the campaign does not exist', async () => {
    prisma.campaign.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.updateCampaign(OWNER_ID, CAMPAIGN_ID, { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('rejects a non-owner, non-admin caller with 403 (IDOR regression)', async () => {
    await expect(
      service.updateCampaign(ATTACKER_ID, CAMPAIGN_ID, { title: 'Defaced' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.campaign.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a non-owner attempting to inject an imageUrl with 403 (phishing regression)', async () => {
    await expect(
      service.updateCampaign(ATTACKER_ID, CAMPAIGN_ID, {
        coverImageUrl: 'https://phishing.example.com/steal.png',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('allows the campaign owner to update and writes an audit log', async () => {
    const result = await service.updateCampaign(OWNER_ID, CAMPAIGN_ID, {
      title: 'Updated by owner',
    });

    expect(result.title).toBe('Updated by owner');
    expect(prisma.campaign.update).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: OWNER_ID,
          action: 'CAMPAIGN_UPDATED',
          resourceType: 'campaign',
          resourceId: CAMPAIGN_ID,
        }),
      }),
    );
  });

  it('allows an admin override even when they are not the owner', async () => {
    const result = await service.updateCampaign(
      ATTACKER_ID,
      CAMPAIGN_ID,
      { title: 'Updated by admin' },
      true,
    );

    expect(result.title).toBe('Updated by admin');
    expect(prisma.campaign.update).toHaveBeenCalledTimes(1);
  });
});

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
