import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Import schemas
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Credential, CredentialSchema } from './schemas/credential.schema';
import { BlockchainTransaction, BlockchainTransactionSchema } from './schemas/transaction.schema';

// Import services
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RelayerService } from './services/relayer.service';
import { WalletService } from './services/wallet.service';
import { CredentialService } from './services/credential.service';

// Import controllers
import { WalletController } from './controllers/wallet.controller';
import { CredentialController } from './controllers/credential.controller';
import { BlockchainController } from './controllers/blockchain.controller';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    MongooseModule.forFeature([
      { name: Credential.name, schema: CredentialSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: BlockchainTransaction.name, schema: BlockchainTransactionSchema },
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
    BlockchainController,
  ],
  exports: [
    CredentialService,
    WalletService,
    RelayerService,
  ],
})
export class BlockchainModule {}
