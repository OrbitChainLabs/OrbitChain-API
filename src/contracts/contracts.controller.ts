import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Controller('contracts')
@UseGuards(AuthGuard('jwt'))
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  /** POST /contracts — Register a new smart contract for a campaign */
  @Post()
  async create(
    @Body() dto: CreateContractDto,
  ): Promise<Record<string, unknown>> {
    return this.contractsService.createContract(dto);
  }

  /** GET /contracts/:contractId — Retrieve contract details with campaign info */
  @Get(':contractId')
  async getDetails(
    @Param('contractId') contractId: string,
  ): Promise<Record<string, unknown>> {
    return this.contractsService.getContractDetails(contractId);
  }
}
