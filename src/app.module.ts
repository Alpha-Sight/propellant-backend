import { Module } from '@nestjs/common';
import { AuthModule } from './module/v1/auth/auth.module';
import { UserModule } from './module/v1/user/user.module';
import { RepositoryModule } from './module/v1/repository/repository.module';
import { OtpModule } from './module/v1/otp/otp.module';
import { MailModule } from './module/v1/mail /mail.module';
import { SettingModule } from './module/v1/setting/setting.module';
import { DatabaseModule } from './module/v1/database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CredentialModule } from './module/v1/credential/credential.module';
import { WaitlistModule } from './module/v1/waitlist/waitlist.module';
import { BlockchainModule } from './module/v1/blockchain/blockchain.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CvModule } from './module/v1/cv/cv.module';
import { PremiumModule } from './module/v1/premium/premium.module';
import { PaymentModule } from './module/v1/payment/payment.module';
import { TransactionModule } from './module/v1/transaction/transaction.module';
import { OrganizationPostModule } from './module/v1/organization-post/organization-post.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UserModule,
    RepositoryModule,
    MailModule,
    OtpModule,
    SettingModule,
    EventEmitterModule.forRoot({
      global: true, // Make it global so other modules can use it
    }),
    CredentialModule,
    WaitlistModule,
    CvModule,
    PremiumModule,
    PaymentModule,
    TransactionModule,
    BlockchainModule,
    OrganizationPostModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
