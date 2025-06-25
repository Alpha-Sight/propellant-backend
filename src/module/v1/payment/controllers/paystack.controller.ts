import { Body, Controller, Post, Req } from '@nestjs/common';
import { PaystackService } from '../services/paystack.service';
import { Request } from 'express';
import { Public } from '../../../../common/decorators/public.decorator';
import { IPaystackPaymentWebhook } from 'src/common/interfaces/paystack.interface';

@Controller('paystack')
export class PaystackController {
  constructor(private paystackService: PaystackService) {}

  @Public()
  @Post('process/hook/internal')
  async paymentWebhook(
    @Req() req: Request,
    @Body() payload: IPaystackPaymentWebhook,
  ) {
    console.log('paystack webhook payload', payload);
    this.paystackService.paymentWebhook(req, payload);
    return;
  }
}
