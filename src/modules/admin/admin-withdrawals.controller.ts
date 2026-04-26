import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/user-role.enum';
import { ProcessWithdrawalDto } from './dto/process-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('admin/withdrawals')
@Roles(UserRole.ADMIN)
export class AdminWithdrawalsController {
  constructor(private readonly adminWithdrawalsService: AdminWithdrawalsService) {}

  @Get()
  listWithdrawals(@Query() query: ListWithdrawalsQueryDto) {
    return this.adminWithdrawalsService.listWithdrawals(query);
  }

  @Get('stats')
  getWithdrawalStats() {
    return this.adminWithdrawalsService.getWithdrawalStats();
  }

  @Get(':id')
  getWithdrawal(@Param('id') id: string) {
    return this.adminWithdrawalsService.getWithdrawal(id);
  }

  @Patch(':id/process')
  processWithdrawal(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ProcessWithdrawalDto
  ) {
    return this.adminWithdrawalsService.processWithdrawal(id, user.id, dto);
  }
}
