import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { CredentialService } from '../services/credential.service';
import { LoggedInUserDecorator } from '../../../../common/decorators/logged-in-user.decorator';
import { UserDocument } from '../../user/schemas/user.schema';
import { ResponseMessage } from '../../../../common/decorators/response.decorator';
import { MintCredentialDto } from '../dto/mint-credential.dto';

@Controller('blockchain/credentials')
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Post('mint')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential minting transaction queued successfully')
  async mintCredential(
    @Body() payload: MintCredentialDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    // Only admins or approved issuers can mint credentials
    if (!user.role?.includes('ADMIN') && !user.role?.includes('ISSUER')) {
      throw new Error(
        'Unauthorized: Only admins or approved issuers can mint credentials',
      );
    }

    return this.credentialService.mintCredential(payload, user._id.toString());
  }

  @Get(':walletAddress')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credentials retrieved successfully')
  async getCredentialsForWallet(@Param('walletAddress') walletAddress: string) {
    return this.credentialService.getCredentialsForWallet(walletAddress);
  }

  @Get('verify/:credentialId')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential verification transaction queued successfully')
  async verifyCredential(
    @Param('credentialId') credentialId: string,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    // Only admins or approved issuers can verify credentials
    if (!user.role?.includes('ADMIN') && !user.role?.includes('ISSUER')) {
      throw new Error(
        'Unauthorized: Only admins or approved issuers can verify credentials',
      );
    }

    return this.credentialService.verifyCredential(
      credentialId,
      user._id.toString(),
    );
  }

  @Get('revoke/:credentialId')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Credential revocation transaction queued successfully')
  async revokeCredential(
    @Param('credentialId') credentialId: string,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    // Only admins or approved issuers can revoke credentials
    if (!user.role?.includes('ADMIN') && !user.role?.includes('ISSUER')) {
      throw new Error(
        'Unauthorized: Only admins or approved issuers can revoke credentials',
      );
    }

    return this.credentialService.revokeCredential(
      credentialId,
      user._id.toString(),
    );
  }
}
