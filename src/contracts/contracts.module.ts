import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

/** Module providing Soroban smart contract registration and lookup */
@Module({
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
