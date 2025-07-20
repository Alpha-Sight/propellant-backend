import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Import schemas
// import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Credential, CredentialSchema } from './schemas/credential.schema';

// Import services

import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  BlockchainTransaction,
  BlockchainTransactionSchema,
} from './schemas/transaction.schema';

import { RelayerService } from './services/relayer.service';
import { WalletService } from './services/wallet.service';
import { CredentialService } from './services/credential.service';

// Import controllers
import { WalletController } from './controllers/wallet.controller';
import { CredentialController } from './controllers/credential.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([

      { name: Credential.name, schema: CredentialSchema },
      { name: Wallet.name, schema: WalletSchema },
//       { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [
    CredentialService,
    WalletService,
    RelayerService,
  ],
  controllers: [
    WalletController,
    CredentialController,
  ],
  exports: [
    CredentialService,
    WalletService,
    RelayerService,
  ],
      { name: BlockchainTransaction.name, schema: BlockchainTransactionSchema },
    ]),
  ],
  providers: [RelayerService, WalletService, CredentialService],
  controllers: [BlockchainController, WalletController, CredentialController],
  exports: [RelayerService, WalletService, CredentialService],

})
export class BlockchainModule {}
