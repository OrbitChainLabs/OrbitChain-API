import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../users/email.service';
import { KycStatus, UserRole, UserStatus } from '../../../generated/prisma';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const { search, role, kycStatus, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (role) where.role = role;
    if (kycStatus) where.kycStatus = kycStatus;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, status: true, kycStatus: true, createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true, country: true,
        bio: true, avatar: true, role: true, status: true, isEmailVerified: true,
        walletAddress: true, kycStatus: true, kycSubmittedAt: true,
        kycVerifiedAt: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateRole(id: string, role: UserRole) {
    await this.getUser(id);
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  async softDeleteUser(id: string) {
    await this.getUser(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.DELETED },
    });
    return { message: 'User deleted successfully' };
  }

  async updateKycStatus(id: string, dto: UpdateKycStatusDto) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {
      kycStatus: dto.status,
      ...(dto.status === KycStatus.APPROVED && { kycVerifiedAt: new Date() }),
      ...(dto.status === KycStatus.REJECTED && { kycVerifiedAt: null }),
    };

    const updated = await this.prisma.user.update({ where: { id }, data });

    try {
      await this.emailService.sendKycStatusEmail(user.email, dto.status);
    } catch {
      // non-blocking
    }

    return { message: `KYC status updated to ${dto.status}`, kycStatus: updated.kycStatus };
  }

  async suspendUser(id: string) {
    await this.getUser(id);
    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED },
    });
    return { message: 'User suspended successfully' };
  }

  async unsuspendUser(id: string) {
    await this.getUser(id);
    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });
    return { message: 'User unsuspended successfully' };
  }
}
