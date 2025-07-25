/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import {
  ChangeEmailDto,
  UpdatePasswordDto,
  UpdateTalentProfileDto,
  UserAvailabilityDto,
} from '../dto/user.dto';
import { NoCache } from '../../../../common/decorators/cache.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { RESPONSE_CONSTANT } from '../../../../common/constants/response.constant';
import { ResponseMessage } from '../../../../common/decorators/response.decorator';
import { LoggedInUserDecorator } from '../../../../common/decorators/logged-in-user.decorator';
import { UserDocument } from '../schemas/user.schema';
import { PaginationDto } from '../../repository/dto/repository.dto';

@NoCache()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @ResponseMessage(RESPONSE_CONSTANT.USER.GET_CURRENT_USER_SUCCESS)
  @Get('/')
  async getCurrentUser(@LoggedInUserDecorator() user: { _id: string }) {
    return await this.userService.getUserById(user._id.toString());
  }

  @ResponseMessage(RESPONSE_CONSTANT.USER.CHANGE_EMAIL_SUCCESS)
  @Patch('email')
  async updateEmail(
    @Body() payload: ChangeEmailDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    return await this.userService.changeEmail(payload, user);
  }

  @Patch('password')
  async updatePassword(
    @Body() payload: UpdatePasswordDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    return await this.userService.updatePassword(user, payload);
  }

  @UseInterceptors(FileInterceptor('image'))
  @Patch('profile')
  async updateTalentProfile(
    @Body() payload: UpdateTalentProfileDto,
    @LoggedInUserDecorator() user: UserDocument,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.userService.updateProfile(user, payload, file);
  }

  @Public()
  @Get('check-email')
  async checkPhoneOrEmailExists(@Query() query: UserAvailabilityDto) {
    return this.userService.checkPhoneOrEmailExists(query);
  }

  @Get('referrals')
  async showUserReferrals(
    @Query() payload: PaginationDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    return await this.userService.showUserReferrals(user, payload);
  }

  // @Patch('visibility')
  // async updateVisibility(
  //   @LoggedInUserDecorator() organization: OrganizationDocument,
  //   @Body('visibility') visibility: OrganizationVisibilityEnum,
  // ): Promise<OrganizationDocument> {
  //   return this.userService.updateOrganizationUserVisibility(
  //     organization._id.toString(),
  //     visibility,
  //   );
  // }

  // @Delete()
  // async deleteOrganization(
  //   @LoggedInUserDecorator() organization: OrganizationDocument,
  // ): Promise<{ message: string }> {
  //   return this.userService.deleteOrganizationUser(organization._id.toString());
  // }
}
