import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrganizationPostService } from './organization-post.service';
import {
  CreateJobPostDto,
  GetAllJobPostsDto,
  UpdateJobPostDto,
} from './dto/organization-post.dto';
import { LoggedInUserDecorator } from '../../../common/decorators/logged-in-user.decorator';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../../../common/decorators/role.decorator';
import { UserRoleEnum } from '../../../common/enums/user.enum';
import { NoCache } from '../../../common/decorators/cache.decorator';
import { IDQueryDto } from 'src/common/dto/query.dto';
import { UserDocument } from '../user/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@NoCache()
@UseGuards(JwtAuthGuard)
@Controller('job-post')
export class OrganizationPostController {
  constructor(private readonly organizationService: OrganizationPostService) {}

  @Post()
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPER_ADMIN,
  )
  async createJobPost(
    @LoggedInUserDecorator() organization: UserDocument,
    @Body() payload: CreateJobPostDto,
  ) {
    console.log('user', organization);
    return await this.organizationService.createJobPost(
      organization._id.toString(),
      payload,
    );
  }

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Get('posts')
  async getAllJobPosts(@Query() query: GetAllJobPostsDto) {
    return await this.organizationService.getAllJobPosts(query);
  }

  @Get('organization')
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPER_ADMIN,
  )
  async getOrganizationJobPosts(
    @LoggedInUserDecorator() organization: UserDocument,
    @Query() query: GetAllJobPostsDto,
  ) {
    return await this.organizationService.getOrganizationJobPosts(
      organization,
      query,
    );
  }

  @Get()
  async getJobPostById(@Query('_id') _id: string) {
    return await this.organizationService.getJobPostById(_id);
  }

  @Patch('/:_id/update')
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPER_ADMIN,
  )
  async updateJobPostById(
    @LoggedInUserDecorator() organization: UserDocument,
    @Param('_id') _id: string,
    @Body() payload: UpdateJobPostDto,
  ) {
    return await this.organizationService.updateJobPostById(
      organization,
      _id,
      payload,
    );
  }

  @Delete('remove')
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPER_ADMIN,
  )
  async deleteJobPost(
    @Query('_id') _id: string,
    @LoggedInUserDecorator() organization: UserDocument,
  ) {
    return await this.organizationService.deleteJobPost(
      _id,
      organization._id.toString(),
    );
  }

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Delete('admin/remove')
  async remove(@Query() { _id }: IDQueryDto) {
    return await this.organizationService.softDelete(_id);
  }

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Delete('admin/restore')
  async restore(@Query() { _id }: IDQueryDto) {
    return await this.organizationService.restoreDeleted(_id);
  }

  @Patch('status')
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPER_ADMIN,
  )
  async toggleJobPostActivation(
    @Query('_id') _id: string,
    @LoggedInUserDecorator()
    organization: UserDocument,
  ) {
    return await this.organizationService.toggleJobPostActivation(
      _id,
      organization._id.toString(),
    );
  }

  @Get('stats')
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPER_ADMIN,
  )
  async getJobPostStats(@LoggedInUserDecorator() organization: UserDocument) {
    return await this.organizationService.getJobPostStats(
      organization._id.toString(),
    );
  }

  @Get(':jobPostId/talents')
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPER_ADMIN,
  )
  async getMatchingTalents(@Param('jobPostId') jobPostId: string) {
    const talents =
      await this.organizationService.getMatchingTalentsForJob(jobPostId);
    return {
      message: 'Matching talents fetched successfully',
      data: talents,
    };
  }
}
