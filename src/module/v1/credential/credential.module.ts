import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialController } from './credential.controller';
import { CredentialService } from './credential.service';
import { TalentCredentialSchema } from './schema/credential.schema';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
// import { NotificationModule } from '../notification/notification.module'; // If created

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'TalentCredential', schema: TalentCredentialSchema },
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => MailModule),
    forwardRef(() => BlockchainModule),
    // forwardRef(() => NotificationModule), // Uncomment if created
  ],
  controllers: [CredentialController],
  providers: [CredentialService],
  exports: [CredentialService],
})
export class CredentialModule {}
