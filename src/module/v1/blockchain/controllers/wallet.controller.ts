import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { WalletService } from '../services/wallet.service';
import { LoggedInUserDecorator } from '../../../../common/decorators/logged-in-user.decorator';
import { UserDocument } from '../../user/schemas/user.schema';
import { ResponseMessage } from '../../../../common/decorators/response.decorator';

@Controller('blockchain/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Wallet created successfully')
  async createWallet(@LoggedInUserDecorator() user: UserDocument) {
    const wallet = await this.walletService.createWallet(user._id.toString());
    
    return {
      walletAddress: wallet.walletAddress,
      accountAddress: wallet.accountAddress,
      transactionId: wallet.transactionId
    };
  }
}