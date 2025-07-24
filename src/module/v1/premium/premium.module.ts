import { forwardRef, Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PaymentModule } from '../payment/payment.module';
import { TransactionModule } from '../transaction/transaction.module';
import { UserModule } from '../user/user.module';
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [
    forwardRef(() => PaymentModule),
    UserModule,
    MailModule,
    TransactionModule,
    SettingModule,
  ],
  controllers: [PremiumController],
  providers: [PremiumService],
  exports: [PremiumService],
})
export class PremiumModule {}
