import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async createContract(dto: CreateContractDto) {
    // Verify campaign exists
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${dto.campaignId} not found`);
    }

    // Check if contract already exists for this campaign
    const existingCampaignContract = await this.prisma.smartContract.findUnique({
      where: { campaignId: dto.campaignId },
    });
    if (existingCampaignContract) {
      throw new BadRequestException(`Campaign already has a contract linked to it (Contract: ${existingCampaignContract.contractId})`);
    }

    // Check if contract ID is already registered
    const existingContractId = await this.prisma.smartContract.findUnique({
      where: { contractId: dto.contractId },
    });
    if (existingContractId) {
      throw new BadRequestException(`Contract ID ${dto.contractId} is already registered`);
    }

    return this.prisma.smartContract.create({
      data: {
        contractId: dto.contractId,
        campaignId: dto.campaignId,
        network: dto.network,
        deployedAt: dto.deployedAt ? new Date(dto.deployedAt) : new Date(),
        deployerAddress: dto.deployerAddress,
      },
    });
  }

  async getContractDetails(contractId: string) {
    const contract = await this.prisma.smartContract.findUnique({
      where: { contractId },
      include: {
        campaign: {
          select: {
            title: true,
            status: true,
            goalAmount: true,
            raisedAmount: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${contractId} not found`);
    }

    return contract;
  }
}
