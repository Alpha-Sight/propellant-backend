import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { RelayerService } from './services/relayer.service';
import { BlockchainTransaction, BlockchainTransactionSchema } from './schemas/transaction.schema';
import { Credential, CredentialSchema } from './schemas/credential.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    MongooseModule.forFeature([
      { name: BlockchainTransaction.name, schema: BlockchainTransactionSchema },
      { name: Credential.name, schema: CredentialSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
  ],
  providers: [RelayerService],
  exports: [RelayerService],
})
export class RelayerModule {}