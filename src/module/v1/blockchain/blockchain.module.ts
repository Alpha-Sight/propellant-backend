import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { RelayerService } from './services/relayer.service';
import { BlockchainController } from './controllers/blockchain.controller';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [RelayerService],
  controllers: [BlockchainController],
  exports: [RelayerService],
})
export class BlockchainModule {}