import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { OtpModule } from '../otp/otp.module';
import { MailModule } from '../mail /mail.module';
import { BlockchainModule } from '../blockchain/blockchain.module'; // Add this import
import { ENVIRONMENT } from '../../../common/configs/environment';

@Module({
  imports: [
    {
      ...JwtModule.register({
        secret: ENVIRONMENT.JWT.SECRET,
        signOptions: { expiresIn: '365d' },
      }),
      global: true,
    },
    UserModule,
    forwardRef(() => OtpModule),
    MailModule,
    forwardRef(() => BlockchainModule), // Add this line
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
