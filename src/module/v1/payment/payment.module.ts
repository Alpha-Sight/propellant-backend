import { forwardRef, Global, Module } from '@nestjs/common';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schema/payment.schema';
import { PaystackService } from './services/paystack.service';
import { HttpModule } from '@nestjs/axios';
import { PaystackController } from './controllers/paystack.controller';
import { FlutterwaveController } from './controllers/flutterwave.controller';
import { FlutterwaveService } from './services/flutterwave.service';
import { RepositoryModule } from '../repository/repository.module';
import { PremiumModule } from '../premium/premium.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    HttpModule.register({
      timeout: 8000,
      maxRedirects: 5,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }),
    RepositoryModule,
    forwardRef(() => PremiumModule),
  ],
  controllers: [PaymentController, PaystackController, FlutterwaveController],
  providers: [PaymentService, PaystackService, FlutterwaveService],
  exports: [PaymentService],
})
export class PaymentModule {}
