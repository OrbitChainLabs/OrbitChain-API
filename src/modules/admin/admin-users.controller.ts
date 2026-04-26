import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/user-role.enum';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@Controller('admin/users')
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  // Issue #143
  @Get()
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.adminUsersService.getUser(id);
  }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminUsersService.updateRole(id, dto.role);
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.adminUsersService.softDeleteUser(id);
  }

  // Issue #142
  @Patch(':id/kyc')
  updateKyc(@Param('id') id: string, @Body() dto: UpdateKycStatusDto) {
    return this.adminUsersService.updateKycStatus(id, dto);
  }

  @Patch(':id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.adminUsersService.suspendUser(id);
  }

  @Patch(':id/unsuspend')
  unsuspendUser(@Param('id') id: string) {
    return this.adminUsersService.unsuspendUser(id);
  }
}
