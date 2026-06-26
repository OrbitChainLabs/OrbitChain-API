import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { StellarEventService } from './stellar-event.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StellarEventService — cursor persistence', () => {
  const mockEventCursor = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  };

  const mockPrisma = {
    eventCursor: mockEventCursor,
    smartContract: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  let mockConfig: { get: jest.Mock };
  let mockQueue: { add: jest.Mock };

  function buildConfig(url: string) {
    mockConfig = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'STELLAR_HORIZON_URL') return url;
        if (key === 'STELLAR_NETWORK') return undefined;
        return fallback;
      }),
    };
  }

  async function createService(): Promise<StellarEventService> {
    mockQueue = { add: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarEventService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken('contract-events'), useValue: mockQueue },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    return module.get<StellarEventService>(StellarEventService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cursor persistence', () => {
    it('loads cursor from Postgres on bootstrap when one exists', async () => {
      buildConfig('https://horizon-testnet.stellar.org');
      const svc = await createService();
      mockEventCursor.findUnique.mockResolvedValue({
        cursor: '123-456',
        network: 'testnet',
      });
      (svc as any).active = false;

      await svc.onApplicationBootstrap();

      expect(mockEventCursor.findUnique).toHaveBeenCalledWith({
        where: { network: 'testnet' },
      });
    });

    it('starts from "now" when no cursor is found', async () => {
      buildConfig('https://horizon-testnet.stellar.org');
      const svc = await createService();
      mockEventCursor.findUnique.mockResolvedValue(null);
      (svc as any).active = false;

      await svc.onApplicationBootstrap();

      expect(mockEventCursor.findUnique).toHaveBeenCalledWith({
        where: { network: 'testnet' },
      });
      expect((svc as any).lastCursor).toBe('now');
    });
  });

  describe('network detection', () => {
    it('identifies testnet from default URL', async () => {
      buildConfig('https://horizon-testnet.stellar.org');
      const svc = await createService();
      expect((svc as any).network).toBe('testnet');
    });

    it('identifies mainnet from mainnet URL', async () => {
      buildConfig('https://horizon.stellar.org');
      const svc = await createService();
      expect((svc as any).network).toBe('mainnet');
    });

    it('uses STELLAR_NETWORK config when provided', async () => {
      mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'STELLAR_NETWORK') return 'custom-network';
          if (key === 'STELLAR_HORIZON_URL')
            return 'https://horizon-testnet.stellar.org';
          return undefined;
        }),
      };
      const svc = await createService();
      expect((svc as any).network).toBe('custom-network');
    });
  });
});
