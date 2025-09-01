import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  Query,
  UseGuards,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/module/v1/auth/guards/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { UserDocument } from '../user/schemas/user.schema';
import { CredentialService } from './credential.service';
import { RESPONSE_CONSTANT } from 'src/common/constants/response.constant';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import {
  GetAllCredentialsDto,
  UpdateCredentialDto,
  UploadCredentialDto,
  PaginatedCredentialResponse,
  VerifyCredentialDto,
  GetPendingVerificationsDto,
  VerificationStatsResponseDto,
} from './dto/credential.dto';
import { PaginationDto } from '../repository/dto/repository.dto';
import { Roles } from 'src/common/decorators/role.decorator';
import { UserRoleEnum } from 'src/common/enums/user.enum';
import { RoleGuard } from '../auth/guards/role.guard';
import {
  CredentialCategoryEnum,
  CredentialStatusEnum,
  CredentialTypeEnum,
} from 'src/common/enums/credential.enum';

@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCredential(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: UploadCredentialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    console.log('uploadCredential called');
    console.log('User:', user);
    console.log('Payload:', payload);
    console.log('File:', file);

    // Check if the user has exceeded their upload limit
    if (payload.title?.length > 500) {
      throw new BadRequestException(
        'Title is too long. Maximum 500 characters allowed.',
      );
    }

    return await this.credentialService.createCredential(user, payload, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.GET_SUCCESS)
  async getSingleUserCredentials(
    @LoggedInUserDecorator() user: UserDocument,
    @Query() query: PaginationDto,
  ): Promise<PaginatedCredentialResponse> {
    return await this.credentialService.getSingleUserCredentials(user, query);
  }

  @Get('all')
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN)
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.GET_SUCCESS)
  async getAllCredentials(@Query() query: GetAllCredentialsDto) {
    return await this.credentialService.adminGetAllCredentials(query);
  }

  @Get('retrieve')
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.GET_SUCCESS)
  async getCredentialById(@Query('_id') _id: string) {
    return await this.credentialService.getCredentialById(_id);
  }

  // 🚀 NEW VERIFICATION ENDPOINTS

  /**
   * Verify or reject a credential (for organizations)
   */
  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential verification processed successfully')
  async verifyCredential(
    @Param('id') credentialId: string,
    @Body() payload: VerifyCredentialDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    return await this.credentialService.verifyOrRejectCredential(
      credentialId,
      user._id.toString(),
      payload,
    );
  }

  /**
   * Get pending verifications for the logged-in organization
   */
  @Get('pending-verifications')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Pending verifications retrieved successfully')
  async getPendingVerifications(
    @LoggedInUserDecorator() user: UserDocument,
    @Query() query: GetPendingVerificationsDto,
  ): Promise<PaginatedCredentialResponse> {
    return await this.credentialService.getPendingVerifications(
      user.email,
      query,
    );
  }

  /**
   * Get verification statistics for the organization
   */
  @Get('verification-stats')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Verification statistics retrieved successfully')
  async getVerificationStats(
    @LoggedInUserDecorator() user: UserDocument,
  ): Promise<VerificationStatsResponseDto> {
    return await this.credentialService.getVerificationStats(user.email);
  }

  /**
   * Get overdue verifications for admin monitoring
   */
  @Get('overdue-verifications')
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN)
  @ResponseMessage('Overdue verifications retrieved successfully')
  async getOverdueVerifications(@Query() query: GetPendingVerificationsDto) {
    return await this.credentialService.getOverdueVerifications(query);
  }

  /**
   * Resend verification request email
   */
  @Post(':id/resend-verification')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Verification request resent successfully')
  async resendVerificationRequest(
    @Param('id') credentialId: string,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    return await this.credentialService.resendVerificationRequest(
      credentialId,
      user._id.toString(),
    );
  }

  /**
   * Retry minting for verified credentials
   */
  @Post(':id/retry-minting')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential minting retry initiated')
  async retryMinting(
    @Param('id') credentialId: string,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    return await this.credentialService.retryMinting(
      credentialId,
      user._id.toString(),
    );
  }

  /**
   * Get blockchain status for user's credentials
   */
  @Get('blockchain-status')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Blockchain status retrieved successfully')
  async getBlockchainStatus(@LoggedInUserDecorator() user: UserDocument) {
    return await this.credentialService.getBlockchainStatus(
      user._id.toString(),
    );
  }

  // EXISTING ENDPOINTS (PRESERVED)

  @Patch(':_id/update')
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.UPLOAD_SUCCESS)
  async updateCredential(
    @Param('_id') _id: string,
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: UpdateCredentialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.credentialService.updateCredential(
      _id,
      user,
      payload,
      file,
    );
  }

  @Delete()
  @ResponseMessage('Credential deleted successfully')
  async deleteCredential(
    @LoggedInUserDecorator() user: UserDocument,
    @Query('_id') _id: string,
  ) {
    return await this.credentialService.deleteCredential(user, _id);
  }

  @Get('retrieve-verifiable-credentials')
  @UseGuards(RoleGuard)
  @Roles(
    UserRoleEnum.ORGANIZATION,
    UserRoleEnum.SUPER_ADMIN,
    UserRoleEnum.ADMIN,
  )
  @ResponseMessage('Organization verifiable credentials retrieved successfully')
  async getAllOrganizationVerifiableCredentials(
    @LoggedInUserDecorator() user: UserDocument,
    @Query()
    query: PaginationDto & {
      type?: CredentialTypeEnum;
      category?: CredentialCategoryEnum;
      verificationStatus?: CredentialStatusEnum;
    },
  ) {
    return this.credentialService.getAllOrganizationVerifiableCredentials(
      user,
      query,
    );
  }
}
