import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../users/email.service';
import { SearchProjectsDto } from './dto/search-projects.dto';

describe('ProjectsService - Search', () => {
  let service: ProjectsService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    project: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    projectImage: {
      findMany: jest.fn(),
    },
  };

  const mockEmailService = {
    sendProjectApprovalEmail: jest.fn(),
    sendProjectRejectionEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('findAll with search', () => {
    it('should return search results with relevance scoring', async () => {
      const searchDto: SearchProjectsDto = {
        search: 'education',
        page: 1,
        limit: 10,
        sortBy: 'relevance',
        sortOrder: 'desc'
      };

      const mockProjects = [
        {
          id: '1',
          title: 'Education Project',
          description: 'Help children learn',
          category: 'EDUCATION',
          status: 'ACTIVE',
          relevance_score: 0.8,
          match_type: 3,
          created_at: new Date(),
          updated_at: new Date(),
          goal_amount: 1000,
          raised_amount: 500,
          creator_id: 'user1',
          image_url: null,
          wallet_address: null,
          start_date: null,
          end_date: null,
          paused_at: null,
          approved_at: null,
          rejected_at: null,
          rejection_reason: null
        }
      ];

      const mockCount = [{ total: BigInt(1) }];
      const mockCreators = [{ id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe' }];
      const mockImages: any[] = [];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount);

      mockPrisma.user.findMany.mockResolvedValue(mockCreators);
      mockPrisma.projectImage.findMany.mockResolvedValue(mockImages);

      const result = await service.findAll(searchDto);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('relevance_score');
      expect(result.data[0]).toHaveProperty('match_type');
      expect(result.pagination.total).toBe(1);
    });

    it('should handle search with filters', async () => {
      const searchDto: SearchProjectsDto = {
        search: 'health',
        category: 'HEALTH',
        status: 'ACTIVE',
        page: 1,
        limit: 5
      };

      const mockProjects: any[] = [];
      const mockCount = [{ total: BigInt(0) }];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockCount);

      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.projectImage.findMany.mockResolvedValue([]);

      const result = await service.findAll(searchDto);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should return regular results without search', async () => {
      const searchDto: SearchProjectsDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const mockProjects = [
        {
          id: '1',
          title: 'Test Project',
          creator: { id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
          images: []
        }
      ];

      mockPrisma.project.findMany.mockResolvedValue(mockProjects);
      mockPrisma.project.count.mockResolvedValue(1);

      const result = await service.findAll(searchDto);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      const mockTitleSuggestions = [
        { title: 'Education for All', relevance_score: 0.9 }
      ];
      const mockCategorySuggestions = [
        { category: 'EDUCATION', relevance_score: 0.8 }
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockTitleSuggestions)
        .mockResolvedValueOnce(mockCategorySuggestions);

      const result = await service.getSearchSuggestions('edu', 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('type');
      expect(result[0]).toHaveProperty('relevance_score');
    });

    it('should return empty array for short queries', async () => {
      const result = await service.getSearchSuggestions('e', 10);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty queries', async () => {
      const result = await service.getSearchSuggestions('', 10);
      expect(result).toHaveLength(0);
    });
  });
});
