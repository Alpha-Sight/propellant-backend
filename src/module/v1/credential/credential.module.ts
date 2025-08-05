import { Module } from '@nestjs/common';
import { RepositoryModule } from '../repository/repository.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialService } from './credential.service';
import { CredentialController } from './credential.controller';
import {
  TalentCredential,
  TalentCredentialSchema,
} from './schema/credential.schema';
import { PinataService } from 'src/common/utils/pinata.util';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TalentCredential.name, schema: TalentCredentialSchema },
    ]),
    RepositoryModule,
    UserModule,
    MailModule,
  ],
  controllers: [CredentialController],
  providers: [CredentialService, PinataService],
  exports: [CredentialService, PinataService],
})
export class CredentialModule {}
