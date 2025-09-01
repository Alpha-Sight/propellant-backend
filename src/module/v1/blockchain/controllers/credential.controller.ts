import { Body, Controller, Get, Param, Post, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { CredentialService } from '../services/credential.service';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { UserDocument } from 'src/module/v1/user/schemas/user.schema';
import { IssueCredentialDto } from '../dto/issue-credential.dto';
import { WalletService } from '../services/wallet.service';

@Controller('blockchain/credentials')
export class CredentialController {
  private readonly logger = new Logger(CredentialController.name);

  constructor(
    private readonly credentialService: CredentialService,
    private readonly walletService: WalletService,
  ) {}

  @Post('issue')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential issuance transaction queued successfully')
  async issueCredential(
    @Body() payload: IssueCredentialDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    // Only admins or approved issuers can issue credentials
    if (!user.role?.includes('ADMIN') && !user.role?.includes('ISSUER')) {
      throw new Error('Unauthorized: Only admins or approved issuers can issue credentials');
    }
    
    return this.credentialService.issueCredential(payload, user._id.toString());
  }

  @Get(':walletAddress')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credentials retrieved successfully')
  async getCredentialsForWallet(@Param('walletAddress') walletAddress: string) {
    return this.credentialService.getCredentialsForWallet(walletAddress);
  }

  @Post('verify/:id')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential verification transaction queued successfully')
  async verifyCredential(
    @Param('id') id: string,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    // Only admins or approved issuers can verify credentials
    if (!user.role?.includes('ADMIN') && !user.role?.includes('ISSUER')) {
      throw new Error('Unauthorized: Only admins or approved issuers can verify credentials');
    }

    // The id parameter is the MongoDB ObjectId of the credential
    const result = await this.credentialService.verifyCredential(id, user._id.toString());

    // Check if service returned an error
    if (result && (result as any).errorType) {
      const err = result as { error?: string; errorType?: string; message?: string };
      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      switch (err.errorType) {
        case 'NOT_READY': status = HttpStatus.CONFLICT; break;
        case 'NOT_FOUND': status = HttpStatus.NOT_FOUND; break;
        case 'INVALID_ID': status = HttpStatus.BAD_REQUEST; break;
        case 'TX_ERROR': status = HttpStatus.BAD_GATEWAY; break;
      }
      this.logger.warn(`${err.message} mongoId=${id}`);
      throw new HttpException(
        { success: false, data: { error: err.error || err.message, errorType: err.errorType, message: err.message } },
        status,
      );
    }

    // Success path — return the queued transaction result
    return { success: true, data: result, message: 'Credential verification transaction queued successfully' };
  }

  @Post('revoke/:id')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential revocation transaction queued successfully')
  async revokeCredential(
    @Param('id') id: string,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    // Only admins or approved issuers can revoke credentials
    if (!user.role?.includes('ADMIN') && !user.role?.includes('ISSUER')) {
      throw new Error('Unauthorized: Only admins or approved issuers can revoke credentials');
    }

    return this.credentialService.revokeCredential(id, user._id.toString());
  }

  @Get('pending/:walletAddress')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Pending credentials retrieved successfully')
  async getPendingCredentialsForWallet(@Param('walletAddress') walletAddress: string) {
    return this.credentialService.getPendingCredentialsForWallet(walletAddress);
  }
}