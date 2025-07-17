import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
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
import { UserDocument } from '../user/schemas/user.schema';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../../../common/decorators/role.decorator';
import { UserRoleEnum } from '../../../common/enums/user.enum';
import { Public } from '../../../common/decorators/public.decorator';
import { NoCache } from '../../../common/decorators/cache.decorator';

@NoCache()
@Controller('job-post')
export class OrganizationPostController {
  constructor(private readonly organizationService: OrganizationPostService) {}

  @Post()
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ORGANIZATION)
  //   @ResponseMessage(RESPONSE_CONSTANT.ORGANIZATION_POST.CREATE_SUCCESS)
  async createJobPost(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: CreateJobPostDto,
  ) {
    return await this.organizationService.createJobPost(user, payload);
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
    @LoggedInUserDecorator() organization: UserDocument,
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

  @Patch()
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ORGANIZATION)
  //   @ResponseMessage(RESPONSE_CONSTANT.ORGANIZATION_POST.UPDATE_SUCCESS)
  async updateJobPostById(
    @LoggedInUserDecorator() organization: UserDocument,
    @Query('_id') _id: string,
    @Body() payload: UpdateJobPostDto,
  ) {
    return await this.organizationService.updateJobPostById(
      organization,
      _id,
      payload,
    );
  }
}
