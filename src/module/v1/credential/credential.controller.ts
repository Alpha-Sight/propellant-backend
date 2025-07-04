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
} from '@nestjs/common';
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
} from './dto/credential.dto';
import { PaginationDto } from '../repository/dto/repository.dto';

@Controller('credentials')
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.UPLOAD_SUCCESS)
  async uploadCredential(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: UploadCredentialDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.credentialService.uploadCredential(user, payload, file);
  }

  @Get()
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.GET_SUCCESS)
  async getSingleUserCredentials(
    @LoggedInUserDecorator() user: UserDocument,
    @Query() query: PaginationDto,
  ) {
    return await this.credentialService.getSingleUserCredentials(user, query);
  }

  @Get('all')
  // @UseGuards(RoleGuard)
  // @Roles(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN)
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.GET_SUCCESS)
  async getAllCredentials(@Query() query: GetAllCredentialsDto) {
    return await this.credentialService.adminGetAllCredentials(query);
  }

  @Get('retrieve')
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.GET_SUCCESS)
  async getCredentialById(@Query('_id') _id: string) {
    return await this.credentialService.getCredentialById(_id);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.UPLOAD_SUCCESS)
  async updateCredential(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: UpdateCredentialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.credentialService.updateCredential(user, payload, file);
  }

  @Delete()
  // @ResponseMessage(RESPONSE_CONSTANT.CREDENTIAL.DELETE_SUCCESS)
  async deleteCredential(
    @LoggedInUserDecorator() user: UserDocument,
    @Query('_id') _id: string,
  ) {
    return await this.credentialService.deleteCredential(user, _id);
  }
}
