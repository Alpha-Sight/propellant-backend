import { Module, forwardRef } from '@nestjs/common';
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
import { UserModule } from '../user/user.module'; // If needed

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    forwardRef(() => UserModule), // Use forwardRef if there's circular dependency
  ],
  controllers: [
    BlockchainController, 
    WalletController, 
    CredentialController
  ],
  providers: [RelayerService, WalletService, CredentialService],
  exports: [RelayerService, WalletService, CredentialService], // Export WalletService so AuthModule can use it
})
export class BlockchainModule {}