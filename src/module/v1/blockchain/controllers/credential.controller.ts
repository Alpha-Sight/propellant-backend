import { Body, Controller, Get, Param, Post, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { CredentialService } from '../services/credential.service';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { UserDocument } from 'src/module/v1/user/schemas/user.schema';
import { IssueCredentialDto } from '../dto/issue-credential.dto';
import { WalletService } from '../services/wallet.service';
import { UserRoleEnum } from 'src/common/enums/user.enum';

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
    // Allow admins, issuers, and organizations to verify credentials
    if (user.role !== UserRoleEnum.ADMIN && 
        user.role !== UserRoleEnum.SUPER_ADMIN && 
        user.role !== UserRoleEnum.ORGANIZATION && 
        !user.role?.includes('ISSUER')) {
      this.logger.error(`Unauthorized verification attempt by user with role: ${user.role}`);
      throw new Error('Unauthorized: Only admins, organizations, or approved issuers can verify credentials');
    }
    this.logger.log(`Credential verification requested by user ${user._id} with role ${user.role}`);

    // The id parameter is the MongoDB ObjectId of the credential
    const credential = await this.credentialService.verifyCredential(id, user._id.toString());

    // Ensure on-chain id exists and issue was mined
  if (!credential.blockchainCredentialId && !(credential as any).tokenId) {
      const msg = 'Credential is not yet issued on-chain. Retry after the issue transaction is confirmed (status ISSUED).';
      this.logger.warn(msg + ` mongoId=${id}`);
      throw new HttpException({ success: false, data: { error: msg, errorType: 'NOT_ISSUED_ONCHAIN', message: msg } }, HttpStatus.CONFLICT);
    }

    // Optional stricter check: require verificationStatus === 'ISSUED'
    if (credential.verificationStatus !== 'ISSUED') {
      const msg = `Credential is not ready for verification; current status=${credential.verificationStatus}. Wait until status is ISSUED.`;
      this.logger.warn(msg + ` mongoId=${id}`);
      throw new HttpException({ success: false, data: { error: msg, errorType: 'NOT_READY', message: msg } }, HttpStatus.CONFLICT);
    }

    // Success path — return service result which should contain the queued tx id
    return { success: true, data: credential, message: 'Credential verification transaction queued successfully' };
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