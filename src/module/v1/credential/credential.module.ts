import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { CredentialController } from './credential.controller';
import { CredentialService } from './credential.service';
import { TalentCredentialSchema } from './schema/credential.schema';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PinataService } from 'src/common/utils/pinata.util';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: 'TalentCredential', schema: TalentCredentialSchema },
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => MailModule),
    forwardRef(() => BlockchainModule),
  ],
  controllers: [CredentialController],
  providers: [CredentialService, PinataService],
  exports: [CredentialService],
})
export class CredentialModule {}
