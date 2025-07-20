import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RelayerService } from '../services/relayer.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { QueueTransactionDto } from '../dto/queue-transaction.dto';
import { LoggedInUserDecorator } from '../../../../common/decorators/logged-in-user.decorator';
import { UserDocument } from '../../user/schemas/user.schema';
import { ResponseMessage } from '../../../../common/decorators/response.decorator';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly relayerService: RelayerService) {}

  @Post('transactions')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Transaction queued successfully')
  async queueTransaction(
    @Body() payload: QueueTransactionDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    // Make sure the user can only submit transactions for their own address
    if (
      payload.userAddress.toLowerCase() !== user.walletAddress.toLowerCase()
    ) {
      throw new Error(
        'Unauthorized: Can only submit transactions for your own wallet',
      );
    }

    
    return this.relayerService.queueTransaction({
      ...payload,
      value: payload.value || '0',
      operation: payload.operation || 0,
      description: payload.description || 'User submitted transaction',
    });


//     return this.relayerService.queueTransaction(payload);

  }

  @Get('transactions/:id')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Transaction status retrieved')
  async getTransactionStatus(@Param('id') transactionId: string) {
    return this.relayerService.getTransactionStatus(transactionId);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('User transactions retrieved')
  async getUserTransactions(@LoggedInUserDecorator() user: UserDocument) {
    return this.relayerService.getUserTransactions(user.walletAddress);
  }
}
