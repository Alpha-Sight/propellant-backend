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
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.UPLOAD_SUCCESS)
  async uploadCredential(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: UploadCredentialDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    console.log('uploadCredential called');
    console.log('User:', user?._id);
    console.log('Payload:', payload);
    if (file) {
      console.log(
        'File received:',
        file.originalname,
        file.size,
        file.mimetype,
      );
    } else {
      console.log('No file received');
    }
    return await this.credentialService.uploadCredential(user, payload, file);
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
  // @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.DELETE_SUCCESS)
  async deleteCredential(
    @LoggedInUserDecorator() user: UserDocument,
    @Query('_id') _id: string,
  ) {
    return await this.credentialService.deleteCredential(user, _id);
  }

  @Get('verify/retrieve')
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ORGANIZATION)
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
      user.email,
      query,
    );
  }
}
