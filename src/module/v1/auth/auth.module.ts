import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config'; // Add this import
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { OtpModule } from '../otp/otp.module';
import { MailModule } from '../mail /mail.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ENVIRONMENT } from '../../../common/configs/environment';
import { JwtStrategy } from './strategies/jwt.strategy';


@Module({
  imports: [
    ConfigModule, // Add ConfigModule here
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
    forwardRef(() => BlockchainModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
