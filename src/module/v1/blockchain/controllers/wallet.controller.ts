import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { WalletService } from '../services/wallet.service';
import { ResponseMessage } from '../../../../common/decorators/response.decorator';

@Controller('blockchain/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Wallet created successfully')
  async createWallet() {
    const wallet = await this.walletService.createWallet();

    return {
      walletAddress: wallet.walletAddress,
      accountAddress: wallet.accountAddress,
      transactionId: wallet.transactionId,
    };
  }
}
