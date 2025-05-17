import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRoleEnum } from '../../../../common/enums/user.enum';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { RepositoryService } from '../../repository/repository.service';
import {
  AdminAssignRoleDto,
  ActivateDeactivateAdminDto,
  SuspendUserDto,
} from '../dto/user-admin.dto';
import { AdminGetAllUsersDto } from '../dto/user.dto';
import { User, UserDocument } from '../schemas/user.schema';
import { BaseRepositoryService } from '../../repository/base.service';
@Injectable()
export class AdminUserService extends BaseRepositoryService<UserDocument> {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private repositoryService: RepositoryService,
  ) {
    super(userModel);
  }

  async getAllAdmins(query: PaginationDto) {
    const { searchQuery } = query;

    let search = {};
    if (searchQuery) {
      search = {
        $or: [
          { firstName: { $regex: searchQuery, $options: 'i' } },
          { lastName: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } },
        ],
      };
    }

    const [stats, result] = await Promise.all([
      this.userModel.aggregate([
        {
          $match: {
            role: { $in: [UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN] },
          },
        },
        {
          $group: {
            _id: '$role',
            total: { $sum: 1 },
          },
        },
      ]),
      this.repositoryService.paginate<UserDocument>({
        model: this.userModel,
        query,
        options: {
          role: { $in: [UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN] },
          ...search,
        },
      }),
    ]);

    return {
      stats,
      data: result,
    };
  }

  async adminAssignRole(adminId: string, payload: AdminAssignRoleDto) {
    const { assigneeId, role } = payload;

    if (adminId.toString() === assigneeId.toString()) {
      throw new BadRequestException('You cannot assign role to yourself');
    }

    if (role === UserRoleEnum.SUPER_ADMIN) {
      throw new BadRequestException('You cannot assign super admin role');
    }

    const result = await this.userModel.findByIdAndUpdate(
      assigneeId,
      { role },
      {
        new: true,
      },
    );

    // send email to user

    return result;
  }

  async activateDeactivateAdmin(
    admin: UserDocument,
    payload: ActivateDeactivateAdminDto,
  ) {
    const { adminToUpdateId, isActive } = payload;

    if (admin._id.toString() === adminToUpdateId.toString()) {
      throw new BadRequestException('You cannot deactivate yourself');
    }

    const response = await this.userModel.findByIdAndUpdate(
      adminToUpdateId,
      { deactivated: !isActive },
      {
        new: true,
      },
    );

    return response;
  }

  async adminGetAllUsers(query: AdminGetAllUsersDto) {
    const { isDeleted, role, searchQuery, ...paginationQuery } = query;

    let search = {};
    if (searchQuery) {
      search = {
        $or: [
          { firstName: { $regex: searchQuery, $options: 'i' } },
          { lastName: { $regex: searchQuery, $options: 'i' } },
          { email: { $regex: searchQuery, $options: 'i' } },
        ],
      };
    }

    return await this.repositoryService.paginate<UserDocument>({
      model: this.userModel,
      query: paginationQuery,
      options: {
        ...(isDeleted && { isDeleted }),
        ...(role && { role }),
        ...search,
      },
    });
  }

  async suspendUser(id: string, payload: SuspendUserDto) {
    await this.userModel.findByIdAndUpdate(id, {
      ...payload,
      accountSuspended: true,
    });
  }

  async unSuspendUser(id: string) {
    const suspend = await this.userModel.findByIdAndUpdate(
      id,
      {
        accountSuspended: false,
      },
      { new: true },
    );

    if (!suspend) {
      throw new NotFoundException(`Unsuspend attempt failed for user ${id}`);
    }

    return suspend;
  }
}
