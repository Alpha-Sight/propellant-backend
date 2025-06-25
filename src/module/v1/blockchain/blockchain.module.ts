import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { RelayerService } from './services/relayer.service';
import { BlockchainController } from './controllers/blockchain.controller';
import { WalletService } from './services/wallet.service';
import { WalletController } from './controllers/wallet.controller';
import { CredentialService } from './services/credential.service';
import { CredentialController } from './controllers/credential.controller';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [RelayerService, WalletService, CredentialService],
  controllers: [BlockchainController, WalletController, CredentialController],
  exports: [RelayerService, WalletService, CredentialService],
})
export class BlockchainModule {}
