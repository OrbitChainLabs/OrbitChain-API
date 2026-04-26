import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WithdrawalStatus } from '../../../../generated/prisma';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { ProcessWithdrawalDto } from './dto/process-withdrawal.dto';

@Injectable()
export class AdminWithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  async listWithdrawals(query: ListWithdrawalsQueryDto) {
    const { search, status, projectId, creatorId, startDate, endDate, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (creatorId) where.creatorId = creatorId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    if (search) {
      where.OR = [
        { project: { title: { contains: search, mode: 'insensitive' } } },
        { creator: { firstName: { contains: search, mode: 'insensitive' } } },
        { creator: { lastName: { contains: search, mode: 'insensitive' } } },
        { creator: { email: { contains: search, mode: 'insensitive' } } },
        { walletAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [withdrawals, total] = await this.prisma.$transaction([
      this.prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: {
            select: { id: true, title: true, imageUrl: true }
          },
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return { data: withdrawals, total, page, limit };
  }

  async getWithdrawal(id: string) {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { id },
      include: {
        project: {
          select: { id: true, title: true, description: true, imageUrl: true, goalAmount: true, raisedAmount: true }
        },
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true, walletAddress: true }
        }
      },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    return withdrawal;
  }

  async processWithdrawal(id: string, adminId: string, dto: ProcessWithdrawalDto) {
    const withdrawal = await this.prisma.withdrawal.findFirst({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal can only be processed if it is pending');
    }

    const updateData: any = {
      status: dto.status,
      processedBy: adminId,
      processedAt: new Date(),
    };

    if (dto.status === WithdrawalStatus.REJECTED && dto.rejectionReason) {
      updateData.rejectionReason = dto.rejectionReason;
    }

    if (dto.status === WithdrawalStatus.COMPLETED && dto.transactionHash) {
      updateData.transactionHash = dto.transactionHash;
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, title: true } },
        creator: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    return { 
      message: `Withdrawal ${dto.status.toLowerCase()} successfully`, 
      withdrawal: updated 
    };
  }

  async getWithdrawalStats() {
    const [pending, approved, rejected, completed, failed, total] = await Promise.all([
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.PENDING } }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.APPROVED } }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.REJECTED } }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.COMPLETED } }),
      this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.FAILED } }),
      this.prisma.withdrawal.count(),
    ]);

    const totalAmount = await this.prisma.withdrawal.aggregate({
      _sum: { amount: true },
      where: { status: { in: [WithdrawalStatus.APPROVED, WithdrawalStatus.COMPLETED] } }
    });

    return {
      pending,
      approved,
      rejected,
      completed,
      failed,
      total,
      totalProcessedAmount: totalAmount._sum.amount || 0,
    };
  }
}
