import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PauseProjectDto } from './dto/pause-project.dto';
import { ResumeProjectDto } from './dto/resume-project.dto';
import { CompleteProjectDto } from './dto/complete-project.dto';
import { SearchProjectsDto } from './dto/search-projects.dto';
import { GetProjectAnalyticsDto, ProjectAnalyticsResponseDto } from './dto';
import { ProjectStatus, UserRole, AuditActionType } from '../../../generated/prisma';
import { validateStatusTransition, isProjectAcceptingDonations } from './utils/status-transition.validator';
import { EmailService } from '../users/email.service';
import { ProjectDonationsResponseDto } from './dto/project-donations-response.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(creatorId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        ...dto,
        creatorId,
        goalAmount: dto.goalAmount,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return project;
  }

  async findAll(searchDto?: SearchProjectsDto) {
    const {
      search,
      category,
      status,
      categories,
      statuses,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = searchDto || {};

    const skip = (page - 1) * limit;
    const where: any = {};

    // Handle filters
    if (category) {
      where.category = category;
    }
    if (categories && categories.length > 0) {
      where.category = { in: categories };
    }
    if (status) {
      where.status = status;
    }
    if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    }

    // Handle search with full-text search and relevance scoring
    if (search) {
      const searchQuery = search.trim();

      const projects = await this.prisma.$queryRaw`
        SELECT 
          p.*,
          ts_rank(
            setweight(to_tsvector('english', p.title), 'A') || 
            setweight(to_tsvector('english', p.description), 'B') || 
            setweight(to_tsvector('english', p.category::text), 'C'),
            plainto_tsquery('english', ${searchQuery})
          ) as relevance_score,
          (
            CASE 
              WHEN to_tsvector('english', p.title) @@ plainto_tsquery('english', ${searchQuery}) THEN 3
              WHEN to_tsvector('english', p.description) @@ plainto_tsquery('english', ${searchQuery}) THEN 2
              WHEN to_tsvector('english', p.category::text) @@ plainto_tsquery('english', ${searchQuery}) THEN 1
              ELSE 0
            END
          ) as match_type
        FROM projects p
        WHERE 
          to_tsvector('english', p.title || ' ' || p.description || ' ' || p.category::text) @@ plainto_tsquery('english', ${searchQuery})
          ${Object.keys(where).length > 0 ? this.buildWhereClause(where) : ''}
        ORDER BY 
          CASE 
            WHEN ${sortBy} = 'relevance' THEN ts_rank(
              setweight(to_tsvector('english', p.title), 'A') || 
              setweight(to_tsvector('english', p.description), 'B') || 
              setweight(to_tsvector('english', p.category::text), 'C'),
              plainto_tsquery('english', ${searchQuery})
            )
            ELSE 0
          END DESC,
          CASE 
            WHEN ${sortBy} = 'createdAt' THEN p.created_at
            WHEN ${sortBy} = 'updatedAt' THEN p.updated_at
            WHEN ${sortBy} = 'title' THEN p.title
            WHEN ${sortBy} = 'goalAmount' THEN p.goal_amount
            WHEN ${sortBy} = 'raisedAmount' THEN p.raised_amount
            ELSE p.created_at
          END ${sortOrder.toUpperCase()},
          ts_rank(
            setweight(to_tsvector('english', p.title), 'A') || 
            setweight(to_tsvector('english', p.description), 'B') || 
            setweight(to_tsvector('english', p.category::text), 'C'),
            plainto_tsquery('english', ${searchQuery})
          ) DESC
        LIMIT ${limit} OFFSET ${skip}
      `;

      // Get total count for pagination
      const countResult = await this.prisma.$queryRaw`
        SELECT COUNT(*) as total
        FROM projects p
        WHERE 
          to_tsvector('english', p.title || ' ' || p.description || ' ' || p.category::text) @@ plainto_tsquery('english', ${searchQuery})
          ${Object.keys(where).length > 0 ? this.buildWhereClause(where) : ''}
      ` as { total: bigint }[];

      const total = Number(countResult[0]?.total || 0);

      // Fetch related data for each project
      const projectIds = (projects as any[]).map(p => p.id);
      const creators = await this.prisma.user.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, email: true, firstName: true, lastName: true }
      });
      const images = await this.prisma.projectImage.findMany({
        where: { projectId: { in: projectIds } }
      });

      // Combine data
      const result = (projects as any[]).map(project => ({
        ...project,
        creator: creators.find(c => c.id === project.id),
        images: images.filter(img => img.projectId === project.id),
        relevance_score: Number(project.relevance_score),
        match_type: Number(project.match_type)
      }));

      return {
        data: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    }

    // Regular query without search
    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          images: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where })
    ]);

    return {
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  private buildWhereClause(where: any): string {
    const conditions: string[] = [];
    
    if (where.category) {
      if (Array.isArray(where.category.in)) {
        conditions.push(`p.category IN (${where.category.in.map(() => '?').join(',')})`);
      } else {
        conditions.push(`p.category = ?`);
      }
    }
    
    if (where.status) {
      if (Array.isArray(where.status.in)) {
        conditions.push(`p.status IN (${where.status.in.map(() => '?').join(',')})`);
      } else {
        conditions.push(`p.status = ?`);
      }
    }
    
    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  async getSearchSuggestions(query: string, limit: number = 10) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchQuery = query.trim();
    
    // Get title suggestions with relevance scoring
    const titleSuggestions = await this.prisma.$queryRaw`
      SELECT DISTINCT 
        title,
        ts_rank(to_tsvector('english', title), plainto_tsquery('english', ${searchQuery})) as relevance_score
      FROM projects 
      WHERE 
        to_tsvector('english', title) @@ plainto_tsquery('english', ${searchQuery})
        AND status = 'ACTIVE'
      ORDER BY relevance_score DESC, title ASC
      LIMIT ${Math.ceil(limit / 2)}
    ` as { title: string; relevance_score: number }[];

    // Get category suggestions
    const categorySuggestions = await this.prisma.$queryRaw`
      SELECT DISTINCT 
        category::text as category,
        ts_rank(to_tsvector('english', category::text), plainto_tsquery('english', ${searchQuery})) as relevance_score
      FROM projects 
      WHERE 
        to_tsvector('english', category::text) @@ plainto_tsquery('english', ${searchQuery})
        AND status = 'ACTIVE'
      ORDER BY relevance_score DESC, category ASC
      LIMIT ${Math.ceil(limit / 2)}
    ` as { category: string; relevance_score: number }[];

    // Combine and format suggestions
    const suggestions = [
      ...titleSuggestions.map(s => ({
        text: s.title,
        type: 'title' as const,
        relevance_score: Number(s.relevance_score)
      })),
      ...categorySuggestions.map(s => ({
        text: s.category,
        type: 'category' as const,
        relevance_score: Number(s.relevance_score)
      }))
    ];

    // Sort by relevance and limit results
    return suggestions
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        images: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async getProjectDonations(
    projectId: string,
    query: { page: number; limit: number; anonymize: boolean },
  ): Promise<ProjectDonationsResponseDto> {
    // Verify project exists
    await this.findOne(projectId);

    const { page, limit, anonymize } = query;
    const skip = (page - 1) * limit;

    // Get donations with donor info
    const donations = await this.prisma.donation.findMany({
      where: { projectId },
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isAnonymous: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Get total count
    const totalCount = await this.prisma.donation.count({
      where: { projectId },
    });

    // Calculate total amount
    const totalAmountResult = await this.prisma.donation.aggregate({
      where: { projectId },
      _sum: { amount: true },
    });
    const totalAmount = totalAmountResult._sum.amount || 0;

    const totalPages = Math.ceil(totalCount / limit);

    return {
      donations: donations.map((donation) => ({
        ...donation,
        anonymize, // Pass anonymize flag to the DTO transform
      })),
      statistics: {
        totalCount,
        totalAmount: Number(totalAmount),
      },
      pagination: {
        page,
        limit,
        totalPages,
        totalItems: totalCount,
      },
    };
  }

  private async checkAuthorization(
    projectId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{ project: any; isCreator: boolean; isAdmin: boolean }> {
    const project = await this.findOne(projectId);
    const isCreator = project.creatorId === userId;
    const isAdmin = userRole === UserRole.ADMIN;

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('You are not authorized to perform this action');
    }

    return { project, isCreator, isAdmin };
  }

  
  async pauseProject(
    projectId: string,
    userId: string,
    userRole: UserRole,
    dto: PauseProjectDto,
  ) {
    const { project } = await this.checkAuthorization(projectId, userId, userRole);

    // Validate status transition (ACTIVE -> PAUSED)
    validateStatusTransition(project.status, ProjectStatus.PAUSED);

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.PAUSED,
        pausedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Record status history
    await this.prisma.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.status,
        newStatus: ProjectStatus.PAUSED,
        reason: dto?.reason || 'Project paused',
      },
    });

    return updatedProject;
  }

  async resumeProject(
    projectId: string,
    userId: string,
    userRole: UserRole,
    dto: ResumeProjectDto,
  ) {
    const { project } = await this.checkAuthorization(projectId, userId, userRole);

    // Validate status transition (PAUSED -> ACTIVE)
    validateStatusTransition(project.status, ProjectStatus.ACTIVE);

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.ACTIVE,
        pausedAt: null,
        updatedAt: new Date(),
      },
    });

    // Record status history
    await this.prisma.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.status,
        newStatus: ProjectStatus.ACTIVE,
        reason: dto?.reason || 'Project resumed',
      },
    });

    return updatedProject;
  }

  async completeProject(
    projectId: string,
    userId: string,
    userRole: UserRole,
    dto: CompleteProjectDto,
  ) {
    const { project } = await this.checkAuthorization(projectId, userId, userRole);

    // Validate status transition (ACTIVE -> COMPLETED)
    validateStatusTransition(project.status, ProjectStatus.COMPLETED);

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.COMPLETED,
        updatedAt: new Date(),
      },
    });

    // Record status history
    await this.prisma.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.status,
        newStatus: ProjectStatus.COMPLETED,
        reason: dto?.reason || 'Project completed',
      },
    });

    return updatedProject;
  }

  async canAcceptDonations(projectId: string): Promise<boolean> {
    const project = await this.findOne(projectId);
    return isProjectAcceptingDonations(project.status);
  }

  async getStatusHistory(projectId: string) {
    await this.findOne(projectId); // Verify project exists

    return this.prisma.projectStatusHistory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectAnalytics(
    projectId: string,
    userId: string,
    userRole: UserRole,
    query: GetProjectAnalyticsDto,
  ): Promise<ProjectAnalyticsResponseDto> {
    // Check authorization
    const { project } = await this.checkAuthorization(projectId, userId, userRole);

    const { startDate, endDate, anonymizeTopDonors = false } = query;

    // Set default date range (last 30 days if not provided)
    const now = new Date();
    const defaultStartDate = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const defaultEndDate = endDate ? new Date(endDate) : now;

    // Build date filter
    const dateFilter = {
      createdAt: {
        gte: defaultStartDate,
        lte: defaultEndDate,
      },
    };

    // Get all donations for the project within date range
    const donations = await this.prisma.donation.findMany({
      where: {
        projectId,
        ...dateFilter,
      },
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate total donations and amount
    const totalDonations = donations.length;
    const totalAmount = donations.reduce((sum, donation) => sum.add(donation.amount), new Decimal(0));
    const uniqueDonors = new Set(donations.map(d => d.donorId)).size;
    const averageDonation = totalDonations > 0 ? totalAmount.div(totalDonations) : new Decimal(0);

    // Calculate funding velocity (donations per day)
    const daysDiff = Math.max(1, Math.ceil((defaultEndDate.getTime() - defaultStartDate.getTime()) / (24 * 60 * 60 * 1000)));
    const fundingVelocity = totalDonations / daysDiff;

    // Calculate daily trends
    const dailyTrends = this.calculateDailyTrends(donations, defaultStartDate, defaultEndDate);

    // Calculate weekly trends
    const weeklyTrends = this.calculateWeeklyTrends(donations, defaultStartDate, defaultEndDate);

    // Calculate top donors
    const topDonors = this.calculateTopDonors(donations, anonymizeTopDonors);

    return {
      totalDonations,
      totalAmount,
      uniqueDonors,
      averageDonation,
      fundingVelocity,
      donationTrends: {
        daily: dailyTrends,
        weekly: weeklyTrends,
      },
      topDonors,
      dateRange: {
        startDate: defaultStartDate.toISOString().split('T')[0],
        endDate: defaultEndDate.toISOString().split('T')[0],
      },
    };
  }

  private calculateDailyTrends(donations: any[], startDate: Date, endDate: Date) {
    const dailyMap = new Map<string, { amount: any; count: number }>();

    // Initialize all days in range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().spli
      dailyMap.set(dateStr, { amount: new this.prisma.Decimal(0), count: 0 });
    }

    // Aggregate donations by day
    donations.forEach(donation => {
      const dateStr = donation.createdAt.toISOString().split('T')[0];
      if (dailyMap.has(dateStr)) {
        const current = dailyMap.get(dateStr)!;
        dailyMap.set(dateStr, {
          amount: current.amount.add(donation.amount),
          count: current.count + 1,
        });
      }
    });

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      amount: data.amount,
      count: data.count,
    }));
  }

  private calculateWeeklyTrends(donations: any[], startDate: Date, endDate: Date) {
    const weeklyMap = new Map<string, { amount: any; count: number }>();

    // Initialize weeks in range
    const startWeek = this.getWeekString(startDate);
    const endWeek = this.getWeekString(endDate);
    
    let currentWeek = startWeek;
    while (currentWeek <= endWeek) {
      weeklyMap.set(currentWeek, { amount: new this.prisma.Decimal(0), count: 0 });
      // Move to next week
      const [year, week] = currentWeek.split('-W').map(Number);
      const nextWeekDate = new Date(year, 0, (week + 1) * 7);
      currentWeek = this.getWeekString(nextWeekDate);
      if (currentWeek > endWeek) break;
    }

    // Aggregate donations by week
    donations.forEach(donation => {
      const weekStr = this.getWeekString(donation.createdAt);
      if (weeklyMap.has(weekStr)) {
        const current = weeklyMap.get(weekStr)!;
        weeklyMap.set(weekStr, {
          amount: current.amount.add(donation.amount),
          count: current.count + 1,
        });
      }
    });

    return Array.from(weeklyMap.entries()).map(([week, data]) => ({
      week,
      amount: data.amount,
      count: data.count,
    }));
  }

  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  private calculateTopDonors(donations: any[], anonymize: boolean) {
    const donorMap = new Map<string, { totalAmount: any; count: number; donor: any }>();

    donations.forEach(donation => {
      const donorId = donation.donorId;
      if (donorMap.has(donorId)) {
        const current = donorMap.get(donorId)!;
        donorMap.set(donorId, {
          totalAmount: current.totalAmount.add(donation.amount),
          count: current.count + 1,
          donor: donation.donor,
        });
      } else {
        donorMap.set(donorId, {
          totalAmount: donation.amount,
          count: 1,
          donor: donation.donor,
        });
      }
    });

    return Array.from(donorMap.values())
      .sort((a, b) => b.totalAmount.sub(a.totalAmount).toNumber())
      .slice(0, 10)
      .map(d => ({
        donorId: anonymize ? undefined : d.donor.id,
        donorName: anonymize ? undefined : `${d.donor.firstName || ''} ${d.donor.lastName || ''}`.trim(),
        totalAmount: d.totalAmount,
        donationCount: d.count,
      }));
  }

  async approveProject(projectId: string, adminId: string, remarks?: string) {
    const project = await this.findOne(projectId);

    // Validate status transition (PENDING -> APPROVED)
    if (project.status !== ProjectStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve project in ${project.status} status. Project must be in PENDING status`,
      );
    }

    // Update project status atomically
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.APPROVED,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
      include: { creator: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    // Record status history
    await this.prisma.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.status,
        newStatus: ProjectStatus.APPROVED,
        reason: 'Project approved by admin',
      },
    });

    // Record audit log
    await this.createAuditLog(
      adminId,
      AuditActionType.PROJECT_APPROVED,
      projectId,
      remarks || 'Project approved',
    );

    // Send email notification to creator
    await this.emailService.sendProjectApprovalEmail(
      updatedProject.creator.email,
      updatedProject.creator.firstName || '',
      updatedProject.title,
    );

    return updatedProject;
  }

  async rejectProject(projectId: string, adminId: string, rejectionReason: string) {
    const project = await this.findOne(projectId);

    // Validate status transition (PENDING -> REJECTED)
    if (project.status !== ProjectStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject project in ${project.status} status. Project must be in PENDING status`,
      );
    }

    // Update project status atomically
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason,
        updatedAt: new Date(),
      },
      include: { creator: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    // Record status history
    await this.prisma.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.status,
        newStatus: ProjectStatus.REJECTED,
        reason: rejectionReason,
      },
    });

    // Record audit log
    await this.createAuditLog(
      adminId,
      AuditActionType.PROJECT_REJECTED,
      projectId,
      `Project rejected: ${rejectionReason}`,
    );

    // Send email notification to creator
    await this.emailService.sendProjectRejectionEmail(
      updatedProject.creator.email,
      updatedProject.creator.firstName || '',
      updatedProject.title,
    );

    return updatedProject;
  }

  private async createAuditLog(
    adminId: string,
    action: AuditActionType,
    projectId?: string,
    remarks?: string,
    userId?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        adminId,
        projectId,
        userId,
        remarks,
      },
    });
  }
}
