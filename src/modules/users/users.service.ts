import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { EmailService } from './email.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { KycStatus } from '../../../generated/prisma';

export interface DonationHistoryItem {
  id: string;
  amount: string;
  assetCode: string | null;
  assetIssuer: string | null;
  transactionHash: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    goalAmount: string;
    raisedAmount: string;
    imageUrl: string | null;
    walletAddress: string | null;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface DonationHistoryResponse {
  totalDonated: string;
  donations: DonationHistoryItem[];
}

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  bio: string | null;
  avatar: string | null;
  role: string;
  status: string;
  isEmailVerified: boolean;
  walletAddress: string | null;
  kycStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  profileCompletion: number;
}

export interface ChangePasswordResponse {
  message: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profileCompletion = this.calculateProfileCompletion(user);

    const {
      id,
      email,
      firstName,
      lastName,
      country,
      bio,
      avatar,
      role,
      status,
      isEmailVerified,
      walletAddress,
      kycStatus,
      createdAt,
      updatedAt,
    } = user;

    return {
      id,
      email,
      firstName,
      lastName,
      country,
      bio,
      avatar,
      role,
      status,
      isEmailVerified,
      walletAddress,
      kycStatus,
      createdAt,
      updatedAt,
      profileCompletion,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId },
      }),
    ]);

    try {
      await this.emailService.sendPasswordChangeConfirmation(
        user.email,
        userId,
      );
    } catch (error) {
      console.error(
        'Failed to send password change confirmation email:',
        error,
      );
    }

    return { message: 'Password changed successfully' };
  }

  async updateProfile(
    userId: string,
    updateData: UpdateUserDto,
  ): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      updateData.walletAddress &&
      updateData.walletAddress !== user.walletAddress
    ) {
      const existingWallet = await this.prisma.user.findUnique({
        where: { walletAddress: updateData.walletAddress },
      });
      if (existingWallet) {
        throw new BadRequestException('Wallet address is already in use');
      }
    }

    const allowedFields = [
      'firstName',
      'lastName',
      'country',
      'bio',
      'avatar',
      'walletAddress',
    ];
    const updatePayload: any = {};

    for (const field of allowedFields) {
      if (updateData[field as keyof UpdateUserDto] !== undefined) {
        updatePayload[field] = updateData[field as keyof UpdateUserDto];
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updatePayload,
    });

    const profileCompletion = this.calculateProfileCompletion(updatedUser);

    const {
      id,
      email,
      firstName,
      lastName,
      country,
      bio,
      avatar,
      role,
      status,
      isEmailVerified,
      walletAddress,
      kycStatus,
      createdAt,
      updatedAt,
    } = updatedUser;

    return {
      id,
      email,
      firstName,
      lastName,
      country,
      bio,
      avatar,
      role,
      status,
      isEmailVerified,
      walletAddress,
      kycStatus,
      createdAt,
      updatedAt,
      profileCompletion,
    };
  }

  async getUserDonationHistory(
    userId: string,
    query: { startDate?: string; endDate?: string },
  ): Promise<DonationHistoryResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (query.startDate && query.endDate) {
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);

      if (startDate > endDate) {
        throw new BadRequestException('startDate must be before endDate');
      }
    }

    const createdAtFilter: any = {};
    if (query.startDate) {
      createdAtFilter.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      createdAtFilter.lte = new Date(query.endDate);
    }

    const where: any = { donorId: userId };
    if (Object.keys(createdAtFilter).length > 0) {
      where.createdAt = createdAtFilter;
    }

    const donations = await this.prisma.donation.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            status: true,
            goalAmount: true,
            raisedAmount: true,
            imageUrl: true,
            walletAddress: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lifetimeAggregate = await this.prisma.donation.aggregate({
      _sum: { amount: true },
      where: { donorId: userId },
    });

    return {
      totalDonated: lifetimeAggregate._sum.amount
        ? lifetimeAggregate._sum.amount.toString()
        : '0',
      donations: donations.map((donation) => ({
        id: donation.id,
        amount: donation.amount.toString(),
        assetCode: donation.assetCode,
        assetIssuer: donation.assetIssuer,
        transactionHash: donation.transactionHash,
        status: donation.status,
        createdAt: donation.createdAt,
        updatedAt: donation.updatedAt,
        project: {
          id: donation.project.id,
          title: donation.project.title,
          description: donation.project.description,
          category: donation.project.category,
          status: donation.project.status,
          goalAmount: donation.project.goalAmount.toString(),
          raisedAmount: donation.project.raisedAmount.toString(),
          imageUrl: donation.project.imageUrl,
          walletAddress: donation.project.walletAddress,
          startDate: donation.project.startDate,
          endDate: donation.project.endDate,
          createdAt: donation.project.createdAt,
          updatedAt: donation.project.updatedAt,
        },
      })),
    };
  }

  // ── Issue #141: Forgot / Reset Password ──────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    // Always return success to avoid user enumeration
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.emailToken.deleteMany({
        where: { userId: user.id, type: 'PASSWORD_RESET' },
      });

      await this.prisma.emailToken.create({
        data: { token, userId: user.id, type: 'PASSWORD_RESET', expiresAt },
      });

      await this.emailService.sendPasswordResetEmail(email, token);
    }
    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const emailToken = await this.prisma.emailToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!emailToken || emailToken.type !== 'PASSWORD_RESET') {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (emailToken.expiresAt < new Date()) {
      await this.prisma.emailToken.delete({ where: { id: emailToken.id } });
      throw new BadRequestException('Reset token has expired');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: emailToken.userId }, data: { password: hashed } }),
      this.prisma.emailToken.delete({ where: { id: emailToken.id } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: emailToken.userId } }),
    ]);

    return { message: 'Password reset successfully' };
  }

  // ── Issue #142: KYC Submit ────────────────────────────────────────────────

  async submitKyc(userId: string, documentUrl: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.kycStatus === KycStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KycStatus.PENDING,
        kycDocumentUrl: documentUrl,
        kycSubmittedAt: new Date(),
      },
    });

    return { message: 'KYC submitted successfully' };
  }

  private calculateProfileCompletion(user: any): number {
    const fields = [
      { name: 'firstName', weight: 0.15 },
      { name: 'lastName', weight: 0.15 },
      { name: 'country', weight: 0.1 },
      { name: 'bio', weight: 0.1 },
      { name: 'avatar', weight: 0.1 },
      { name: 'isEmailVerified', weight: 0.1 },
      { name: 'walletAddress', weight: 0.15 },
      {
        name: 'kycStatus',
        weight: 0.15,
        completedWhen: (val: any) => val === 'VERIFIED' || val === 'PENDING',
      },
    ];

    let completion = 0;

    for (const field of fields) {
      const value = user[field.name];
      if (field.completedWhen) {
        if (field.completedWhen(value)) {
          completion += field.weight;
        }
      } else if (value) {
        completion += field.weight;
      }
    }

    return Math.round(completion * 100);
  }
}
