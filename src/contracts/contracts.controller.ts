import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Controller('contracts')
@UseGuards(AuthGuard('jwt'))
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  async create(@Body() dto: CreateContractDto) {
    return this.contractsService.createContract(dto);
  }

  @Get(':contractId')
  async getDetails(@Param('contractId') contractId: string) {
    return this.contractsService.getContractDetails(contractId);
  }
}
