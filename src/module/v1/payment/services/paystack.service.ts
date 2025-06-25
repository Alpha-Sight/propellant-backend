import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { HttpService } from '@nestjs/axios';
import { ENVIRONMENT } from '../../../../common/configs/environment';
import { createHmac } from 'crypto';
import { Request } from 'express';
import { PaymentProvidersEnum } from 'src/common/enums/payment.enum';
import {
  IBaseInitializePayment,
  IInitializePaymentResponse,
} from 'src/common/interfaces/payment.interface';
import { IPaystackPaymentWebhook } from 'src/common/interfaces/paystack.interface';
import { BaseHelper } from 'src/common/utils/helper/helper.util';

@Injectable()
export class PaystackService {
  constructor(
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    private httpService: HttpService,
  ) {}

  async initializePayment(
    payload: IBaseInitializePayment,
  ): Promise<IInitializePaymentResponse> {
    const paystackPaymentMethod =
      await this.paymentService.getPaymentMethodByName(
        PaymentProvidersEnum.PAYSTACK,
      );

    console.log('paystackPaymentMethod', paystackPaymentMethod);

    if (!paystackPaymentMethod || !paystackPaymentMethod.apiKey) {
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(
      paystackPaymentMethod.apiKey,
    );

    try {
      const res = await this.httpService.axiosRef.post(
        `${ENVIRONMENT.PAYSTACK.HOST}/transaction/initialize`,
        {
          ...payload,
          amount: payload.amount * 100,
        },
        {
          headers: {
            Authorization: `Bearer ${decryptedSecret}`,
          },
        },
      );

      return res?.data?.data?.authorization_url || null;
    } catch (error) {
      console.error('initialize paystack payment error', error);
      throw new BadRequestException(
        'Unable to initialize payment, kindly try again',
      );
    }
  }

  async paymentWebhook(req: Request, payload: IPaystackPaymentWebhook) {
    console.log('paymentWebhook check 1 ');
    const paystackPaymentMethod =
      await this.paymentService.getPaymentMethodByName(
        PaymentProvidersEnum.PAYSTACK,
      );

    if (!paystackPaymentMethod || !paystackPaymentMethod.apiKey) {
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(
      paystackPaymentMethod.apiKey,
    );

    console.log('paymentWebhook check 2');

    //validate event
    const hash = createHmac('sha512', decryptedSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    let constructedPayload: any;

    if (hash == req.headers['x-paystack-signature']) {
      if (payload.event === 'charge.success') {
        console.log('paymentWebhook check 3');
        constructedPayload = {
          transactionId: payload.data.metadata.transactionId,
          reference: payload.data.reference,
          paymentObject: payload,
          fee: payload.data.amount / 1000,
          userId: payload.data.metadata.userId,
        };
      }

      return await this.paymentService.processPremiumPayment(
        constructedPayload,
      );
    } else {
      console.error('Invalid x-paystack-signature');
    }
  }
}
