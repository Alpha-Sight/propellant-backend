import { Controller, Post, Body } from '@nestjs/common';
import { WalletService } from '../services/wallet.service';
import { ResponseMessage } from '../../../../common/decorators/response.decorator';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create')
  @ResponseMessage('Wallet creation initiated successfully')
  async createWallet(@Body() createWalletDto: any) {
    try {
      const wallet = await this.walletService.createWallet(createWalletDto.userAddress, createWalletDto.email);
      
      return {
        success: true,
        data: {
          walletAddress: wallet.walletAddress,
          accountAddress: wallet.accountAddress,
          transactionId: wallet.transactionId
        },
        message: 'Wallet creation initiated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}