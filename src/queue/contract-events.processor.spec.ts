import { ContractEventsProcessor } from './contract-events.processor';
import { Logger } from '@nestjs/common';

describe('ContractEventsProcessor', () => {
  let processor: ContractEventsProcessor;
  let prisma: any;

  const mockJob = (data: any) =>
    ({
      data,
      id: 'test-job-id',
    }) as any;

  beforeEach(() => {
    prisma = {
      processedEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      donation: {
        updateMany: jest.fn(),
      },
      milestone: {
        updateMany: jest.fn(),
      },
    };
    processor = new ContractEventsProcessor(prisma);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('idempotency', () => {
    it('skips already-processed (txHash, eventType) pairs', async () => {
      prisma.processedEvent.findUnique.mockResolvedValue({
        txHash: 'abc',
        eventType: 'DonationReceived',
        processedAt: new Date(),
      });

      const result = await processor.processEvent(
        mockJob({ txHash: 'abc', eventType: 'DonationReceived' }),
      );

      expect(result).toEqual({ skipped: true, reason: 'duplicate' });
      expect(prisma.donation.updateMany).not.toHaveBeenCalled();
      expect(prisma.processedEvent.create).not.toHaveBeenCalled();
    });

    it('processes a new event and records idempotency key', async () => {
      prisma.processedEvent.findUnique.mockResolvedValue(null);
      prisma.processedEvent.create.mockResolvedValue({});
      prisma.donation.updateMany.mockResolvedValue({ count: 1 });

      await processor.processEvent(
        mockJob({
          txHash: 'abc',
          eventType: 'DonationReceived',
          contractId: 'CA...',
          topics: ['DonationReceived', 'G...DONOR'],
          value: { amount: '100' },
          ledger: 12345,
          pagingToken: '123-456',
          createdAt: '2026-06-22T00:00:00Z',
        }),
      );

      expect(prisma.donation.updateMany).toHaveBeenCalledWith({
        where: { txHash: 'abc', status: 'PENDING' },
        data: { status: 'CONFIRMED', confirmedAt: expect.any(Date) },
      });
      expect(prisma.processedEvent.create).toHaveBeenCalledWith({
        data: { txHash: 'abc', eventType: 'DonationReceived' },
      });
    });
  });

  describe('event routing', () => {
    it('updates milestone status on MilestoneReleased', async () => {
      prisma.processedEvent.findUnique.mockResolvedValue(null);
      prisma.processedEvent.create.mockResolvedValue({});
      prisma.milestone.updateMany.mockResolvedValue({ count: 1 });

      await processor.processEvent(
        mockJob({
          txHash: 'def',
          eventType: 'MilestoneReleased',
          contractId: 'CA...',
          topics: ['MilestoneReleased'],
          value: null,
          ledger: 12346,
          pagingToken: '124-456',
          createdAt: '2026-06-22T00:00:01Z',
        }),
      );

      expect(prisma.milestone.updateMany).toHaveBeenCalledWith({
        where: { txHash: 'def', status: 'PENDING' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
    });

    it('warns on unknown event types without crashing', async () => {
      prisma.processedEvent.findUnique.mockResolvedValue(null);
      prisma.processedEvent.create.mockResolvedValue({});
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      await processor.processEvent(
        mockJob({
          txHash: 'xyz',
          eventType: 'UnknownEvent',
          contractId: 'CA...',
          topics: ['UnknownEvent'],
          value: null,
          ledger: 12347,
          pagingToken: '125-456',
          createdAt: '2026-06-22T00:00:02Z',
        }),
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown event type "UnknownEvent"'),
      );
      expect(prisma.processedEvent.create).toHaveBeenCalled();
    });
  });
});
