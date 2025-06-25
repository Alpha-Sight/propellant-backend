import { Controller, Get, Query } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { UserDocument } from '../user/schemas/user.schema';
import { GetUserTransactionsDto } from './dto/transaction.dto';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('all')
  async userTransactions(
    @LoggedInUserDecorator() user: UserDocument,
    @Query() query: GetUserTransactionsDto,
  ) {
    return this.transactionService.userTransactions(user, query);
  }

  @Get()
  async getTransactionByReference(@Query('reference') reference: string) {
    return this.transactionService.getTransactionByReference(reference);
  }
}
