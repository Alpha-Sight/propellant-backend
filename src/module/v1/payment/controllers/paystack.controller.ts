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
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Headers:', req.headers['x-paystack-signature']);
    console.log('Paystack webhook event:', payload?.event);
    
    try {
      const result = await this.paystackService.paymentWebhook(req, payload);
      console.log('Webhook processed successfully:', result);
      return result;
    } catch (error) {
      console.error('Webhook processing error:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }
}
