import { Module } from '@nestjs/common';
import { RepositoryModule } from '../repository/repository.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialService } from './credential.service';
import { CredentialController } from './credential.controller';
import { Credential, CredentialSchema } from './schema/credential.schema';
import { PinataService } from 'src/common/utils/pinata.util';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Credential.name, schema: CredentialSchema },
    ]),
    RepositoryModule,
    UserModule,
  ],
  controllers: [CredentialController],
  providers: [CredentialService, PinataService],
  exports: [CredentialService, PinataService],
})
export class CredentialModule {}
