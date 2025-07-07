import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { IPaystackPaymentWebhook } from '../../../../common/interfaces/paystack.interface';
import { Public } from '../../../../common/decorators/public.decorator';
import { VpayService } from '../services/vpay.service';

@Controller('vpay')
export class VpayController {
  constructor(private vpayService: VpayService) {}

  @Public()
  @Post('process/hook/internal')
  async paymentWebhook(
    @Req() req: Request,
    @Body() payload: IPaystackPaymentWebhook,
  ) {
    console.log('vpay webhook payload', payload);
    this.vpayService.paymentWebhook(req, payload);
    return;
  }
}
