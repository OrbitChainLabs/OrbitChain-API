import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { WebhookDto, WebhookEventType } from './dto/webhook.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class DonationsService {
  constructor(private prisma: PrismaService, private configService: ConfigService) {}

  async create(donorId: string, dto: CreateDonationDto) {
    // Check if project exists and is active
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status !== 'ACTIVE') {
      throw new NotFoundException('Project is not active for donations');
    }

    // Create donation in a transaction to update raisedAmount
    const result = await this.prisma.$transaction(async (tx) => {
      const donation = await tx.donation.create({
        data: {
          amount: dto.amount,
          assetType: dto.assetType,
          projectId: dto.projectId,
          donorId,
        },
      });

      // Update project's raisedAmount
      await tx.project.update({
        where: { id: dto.projectId },
        data: {
          raisedAmount: {
            increment: dto.amount,
          },
        },
      });

      return donation;
    });

    return result;
  }

  async findAll() {
    return this.prisma.donation.findMany({
      include: {
        project: true,
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.donation.findMany({
      where: { projectId },
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async processWebhook(dto: WebhookDto, signature?: string) {
    const logger = new Logger(DonationsService.name);
    
    try {
      // Validate webhook signature if provided
      if (signature) {
        const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');
        if (webhookSecret) {
          const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(dto))
            .digest('hex');
          
          if (signature !== expectedSignature) {
            throw new BadRequestException('Invalid webhook signature');
          }
        }
      }

      // Check for duplicate webhooks
      const existingDonation = await this.prisma.donation.findFirst({
        where: { transactionHash: dto.transactionHash }
      });

      if (existingDonation) {
        logger.log(`Duplicate webhook received for transaction ${dto.transactionHash}`);
        return { message: 'Duplicate transaction processed', donation: existingDonation };
      }

      // Validate project and donor exist
      const [project, donor] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: dto.projectId } }),
        this.prisma.user.findUnique({ where: { id: dto.donorId } })
      ]);

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      if (!donor) {
        throw new NotFoundException('Donor not found');
      }

      // Process donation based on webhook type
      let donationStatus = 'PENDING';
      if (dto.type === WebhookEventType.PAYMENT_SUCCESS || dto.type === WebhookEventType.TRANSACTION_CONFIRMED) {
        donationStatus = 'COMPLETED';
      } else if (dto.type === WebhookEventType.PAYMENT_FAILED) {
        donationStatus = 'FAILED';
      }

      // Create donation and update project raised amount in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        const donation = await tx.donation.create({
          data: {
            amount: dto.amount,
            assetCode: dto.assetCode,
            assetIssuer: dto.assetIssuer,
            transactionHash: dto.transactionHash,
            status: donationStatus,
            projectId: dto.projectId,
            donorId: dto.donorId,
          },
          include: {
            project: {
              select: { id: true, title: true, raisedAmount: true, goalAmount: true }
            },
            donor: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        });

        // Update project's raised amount only for successful donations
        if (donationStatus === 'COMPLETED') {
          await tx.project.update({
            where: { id: dto.projectId },
            data: {
              raisedAmount: {
                increment: dto.amount,
              },
            },
          });
        }

        return donation;
      });

      // Emit real-time event (WebSocket/SSE)
      this.emitDonationEvent(result, dto.type);

      logger.log(`Webhook processed successfully for transaction ${dto.transactionHash}`);
      
      return { 
        message: 'Webhook processed successfully', 
        donation: result 
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Webhook processing failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private emitDonationEvent(donation: any, eventType: WebhookEventType) {
    // This would integrate with WebSocket/SSE implementation
    // For now, we'll log the event that would be emitted
    const logger = new Logger(DonationsService.name);
    
    const eventData = {
      type: 'donation_received',
      data: {
        donation,
        eventType,
        timestamp: new Date().toISOString(),
      },
    };

    logger.log(`Emitting donation event: ${JSON.stringify(eventData)}`);
    
    // TODO: Implement actual WebSocket/SSE emission
    // Example: this.eventEmitter.emit('donation.received', eventData);
  }

  async getDonationStats(projectId?: string) {
    const where = projectId ? { projectId } : {};
    
    const [total, completed, pending, failed, totalAmount] = await Promise.all([
      this.prisma.donation.count({ where }),
      this.prisma.donation.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.donation.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.donation.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.donation.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    return {
      total,
      completed,
      pending,
      failed,
      totalAmount: totalAmount._sum.amount || 0,
    };
  }

  async getLeaderboard(scope: string = 'global', projectId?: string, limit: number = 100, offset: number = 0) {
    if (scope === 'project' && !projectId) {
      throw new BadRequestException('Project ID is required for project-specific leaderboard');
    }

    const where: any = {
      status: 'COMPLETED',
      donor: {
        deletedAt: null,
      },
    };

    if (scope === 'project' && projectId) {
      where.projectId = projectId;
    }

    // Get top donors with their total donations
    const leaderboard = await this.prisma.donation.groupBy({
      by: ['donorId'],
      where,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: limit,
      skip: offset,
    });

    // Get donor details for each entry
    const donors = await this.prisma.user.findMany({
      where: {
        id: {
          in: leaderboard.map(entry => entry.donorId),
        },
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        // Add privacy setting if exists
        // isAnonymous: true,
      },
    });

    // Create a map for quick lookup
    const donorMap = new Map(donors.map(donor => [donor.id, donor]));

    // Format the leaderboard results
    const formattedLeaderboard = leaderboard.map((entry, index) => {
      const donor = donorMap.get(entry.donorId);
      if (!donor) return null;

      return {
        rank: offset + index + 1,
        donor: {
          id: donor.id,
          firstName: donor.firstName,
          lastName: donor.lastName,
          email: donor.email,
          avatar: donor.avatar,
          // Respect privacy settings - would need to add isAnonymous field to User model
          isAnonymous: false, // TODO: Implement based on user preferences
        },
        totalAmount: entry._sum.amount || 0,
        donationCount: entry._count.id,
        // Convert to USD if needed (would need exchange rate service)
        totalAmountUSD: entry._sum.amount || 0, // TODO: Implement currency conversion
      };
    }).filter(Boolean);

    // Get total count for pagination
    const totalCount = await this.prisma.donation.groupBy({
      by: ['donorId'],
      where,
    });

    return {
      data: formattedLeaderboard,
      pagination: {
        total: totalCount.length,
        limit,
        offset,
        hasMore: offset + limit < totalCount.length,
      },
      scope,
      projectId: scope === 'project' ? projectId : null,
      lastUpdated: new Date().toISOString(),
    };
  }
}