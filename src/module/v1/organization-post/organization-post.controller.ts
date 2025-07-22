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
import { Public } from '../../../common/decorators/public.decorator';
import { NoCache } from '../../../common/decorators/cache.decorator';
import { IDQueryDto } from 'src/common/dto/query.dto';
import { OrganizationDocument } from '../user/schemas/organization.schema';

@NoCache()
@Controller('job-post')
export class OrganizationPostController {
  constructor(private readonly organizationService: OrganizationPostService) {}

  @Post()
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ORGANIZATION)
  //   @ResponseMessage(RESPONSE_CONSTANT.ORGANIZATION_POST.CREATE_SUCCESS)
  async createJobPost(
    @LoggedInUserDecorator() organization: OrganizationDocument,
    @Body() payload: CreateJobPostDto,
  ) {
    return await this.organizationService.createJobPost(organization, payload);
  }

  @Public()
  @Get('posts')
  //   @ResponseMessage(RESPONSE_CONSTANT.ORGANIZATION_POST.GET_ALL_SUCCESS)
  async getAllJobPosts(@Query() query: GetAllJobPostsDto) {
    return await this.organizationService.getAllJobPosts(query);
  }

  @Get('organization')
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ORGANIZATION)
  //   @ResponseMessage(
  //     RESPONSE_CONSTANT.ORGANIZATION_POST.GET_ORGANIZATION_POSTS_SUCCESS,
  //   )
  async getOrganizationJobPosts(
    @LoggedInUserDecorator() organization: OrganizationDocument,
    @Query() query: GetAllJobPostsDto,
  ) {
    return await this.organizationService.getOrganizationJobPosts(
      organization,
      query,
    );
  }

  @Public()
  @Get()
  //   @ResponseMessage(RESPONSE_CONSTANT.ORGANIZATION_POST.GET_BY_ID_SUCCESS)
  async getJobPostById(@Query('_id') _id: string) {
    return await this.organizationService.getJobPostById(_id);
  }

  @Patch('/:_id/update')
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ORGANIZATION)
  //   @ResponseMessage(RESPONSE_CONSTANT.ORGANIZATION_POST.UPDATE_SUCCESS)
  async updateJobPostById(
    @LoggedInUserDecorator() organization: OrganizationDocument,
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
  async deleteJobPost(
    @Query('_id') _id: string,
    @LoggedInUserDecorator() organization: OrganizationDocument,
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
  async toggleJobPostActivation(
    @Query('_id') _id: string,
    @LoggedInUserDecorator() organization: OrganizationDocument,
  ) {
    return await this.organizationService.toggleJobPostActivation(
      _id,
      organization._id.toString(),
    );
  }

  @Get('stats')
  async getJobPostStats(
    @LoggedInUserDecorator() organization: OrganizationDocument,
  ) {
    return await this.organizationService.getJobPostStats(
      organization._id.toString(),
    );
  }
}
