import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Import schemas
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Credential, CredentialSchema } from './schemas/credential.schema';

// Import services
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
      { name: Transaction.name, schema: TransactionSchema },
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
})
export class BlockchainModule {}