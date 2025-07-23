import { forwardRef, Module } from '@nestjs/common';
import { OtpController } from './otp.controller';
import { OtpService } from './services/otp.service';
import { MongooseModule } from '@nestjs/mongoose';
import { OTP, OTPSchema } from './schemas/otp.schema';
import { OtpMailService } from './services/otp-mail.service';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OTP.name, schema: OTPSchema }]),
    MailModule,
    forwardRef(() => UserModule),
  ],
  controllers: [OtpController],
  providers: [OtpService, OtpMailService],
  exports: [OtpService],
})
export class OtpModule {}
