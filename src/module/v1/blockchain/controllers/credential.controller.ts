import { Body, Controller, Get, Param, Post, Query, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { CredentialService } from '../services/credential.service';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { UserDocument } from 'src/module/v1/user/schemas/user.schema';
import { IssueCredentialDto } from '../dto/issue-credential.dto';
import { WalletService } from '../services/wallet.service';

@Controller('credentials')
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

  @Post(':id/verify')
  @ResponseMessage('Credential verification processed')
  async verify(
    @Param('id') id: string,
    @Body() payload: { decision: 'VERIFIED' | 'REJECTED'; notes?: string; reason?: string; verifierId?: string },
    @LoggedInUserDecorator() user: UserDocument,
    @Query('waitForMint') waitForMint?: string, // "true" to await mint
  ) {
    const action = payload.decision === 'VERIFIED' ? 'approve' : 'reject';
    const result = await this.credentialService.verifyOrRejectCredential(
      id,
      action,
      payload.notes,
      payload.reason,
      payload.verifierId,
      waitForMint === 'true',
    );

    // If caller wants to wait until minted, poll briefly and return full details.
    if (waitForMint === 'true' && action === 'approve') {
      const minted = await this.credentialService.waitForMintCompletion(id, 60000);
      if (minted) {
        return minted;
      }
      // Fallback if not minted in time
      const partial = await this.credentialService.getBlockchainDetails(id);
      return { ...result, pendingMint: true, ...partial };
    }

    return result;
  }

  // Fetch blockchain details + explorer links at any time
  @Get(':id/blockchain')
  @ResponseMessage('Credential blockchain details')
  async getBlockchainDetails(@Param('id') id: string) {
    return await this.credentialService.getBlockchainDetails(id);
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