import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { WalletService } from '../services/wallet.service';
import { ResponseMessage } from '../../../../common/decorators/response.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'; // Fix import path
import { Request } from 'express';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Wallet created successfully')
  async createWallet(@Req() req: Request, @Body() createWalletDto?: any) {
    try {
      const user = req.user as { email: string; userAddress: string }; // assuming JWT has user info
      const wallet = await this.walletService.createWallet(
        createWalletDto?.userAddress || user?.userAddress,
        createWalletDto?.email || user?.email
      );

      return {
        success: true,
        data: {
          walletAddress: wallet.walletAddress,
          accountAddress: wallet.accountAddress,
          transactionId: wallet.transactionId,
        },
        message: 'Wallet created successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
