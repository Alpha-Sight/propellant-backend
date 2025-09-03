import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Import schemas
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Credential, CredentialSchema } from './schemas/credential.schema';
import { BlockchainTransaction, BlockchainTransactionSchema } from './schemas/transaction.schema';
import { TalentCredential, TalentCredentialSchema } from '../credential/schema/credential.schema';

// Import services
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RelayerService } from './services/relayer.service';
import { WalletService } from './services/wallet.service';
import { CredentialService } from './services/credential.service';

// Import controllers
import { WalletController } from './controllers/wallet.controller';
import { CredentialController } from './controllers/credential.controller';
import { BlockchainController } from './controllers/blockchain.controller';

// Import PinataService
import { PinataService } from 'src/common/utils/pinata.util';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    MongooseModule.forFeature([
      { name: Credential.name, schema: CredentialSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: BlockchainTransaction.name, schema: BlockchainTransactionSchema },
      { name: TalentCredential.name, schema: TalentCredentialSchema },
    ]),
  ],
  providers: [
    CredentialService,
    WalletService,
    RelayerService,
    PinataService, // Add PinataService here
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
    PinataService, // Export PinataService
  ],
})
export class BlockchainModule {}
