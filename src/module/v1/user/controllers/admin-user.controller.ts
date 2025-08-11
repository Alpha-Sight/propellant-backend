import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGetAllUsersDto } from '../dto/user.dto';
import { NoCache } from '../../../../common/decorators/cache.decorator';
import { RoleGuard } from '../../auth/guards/role.guard';
import { UserRoleEnum } from '../../../../common/enums/user.enum';
import { Roles } from '../../../../common/decorators/role.decorator';
import { AdminUserService } from '../services/admin-user.service';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { LoggedInUserDecorator } from '../../../../common/decorators/logged-in-user.decorator';
import {
  ActivateDeactivateAdminDto,
  AdminAssignRoleDto,
  SuspendUserDto,
} from '../dto/user-admin.dto';
import { UserDocument } from '../schemas/user.schema';
import { IDQueryDto } from 'src/common/dto/query.dto';

import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
// ...existing code...
@NoCache()
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
@Controller('users/admin')
export class AdminUserController {
  constructor(private adminUserService: AdminUserService) {}

  @Get('all')
  async adminGetAllUsers(@Query() query: AdminGetAllUsersDto) {
    return await this.adminUserService.adminGetAllUsers(query);
  }

  @Get('all-admins')
  async getAllAdmins(@Query() query: PaginationDto) {
    return await this.adminUserService.getAllAdmins(query);
  }

  @Patch('assign-role')
  async adminAssignRole(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: AdminAssignRoleDto,
  ) {
    return await this.adminUserService.adminAssignRole(
      user._id.toString(),
      payload,
    );
  }

  @Patch('activate-deactivate')
  async activateDeactivateAdmin(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: ActivateDeactivateAdminDto,
  ) {
    return await this.adminUserService.activateDeactivateAdmin(user, payload);
  }

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Patch('suspend')
  async suspendUser(
    @Query() { _id }: IDQueryDto,
    @Body() payload: SuspendUserDto,
  ) {
    return await this.adminUserService.suspendUser(_id, payload);
  }

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Patch('unsuspend')
  async unsuspendUser(@Query() { _id }: IDQueryDto) {
    return await this.adminUserService.unSuspendUser(_id);
  }

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Delete('remove')
  async remove(@Query() { _id }: IDQueryDto) {
    return await this.adminUserService.softDelete(_id);
  }

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Delete('restore')
  async restore(@Query() { _id }: IDQueryDto) {
    return await this.adminUserService.restoreDeleted(_id);
  }
}
