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
import { IVpayPaymentWebhook } from 'src/common/interfaces/vpay.interface';
import { BaseHelper } from 'src/common/utils/helper/helper.util';

@Injectable()
export class VpayService {
  constructor(
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    private httpService: HttpService,
  ) {}

  async initializePayment(
    payload: IBaseInitializePayment,
  ): Promise<IInitializePaymentResponse> {
    const paymentMethod = await this.paymentService.getPaymentMethodByName(
      PaymentProvidersEnum.VPAY,
    );

    if (!paymentMethod || !paymentMethod.apiKey) {
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(paymentMethod.apiKey);

    try {
      const res = await this.httpService.axiosRef.post(
        `${ENVIRONMENT.VPAY.HOST}/transaction/initialize`,
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

  async paymentWebhook(req: Request, payload: IVpayPaymentWebhook) {
    console.log('paymentWebhook check 1 ');
    const paymentMethod = await this.paymentService.getPaymentMethodByName(
      PaymentProvidersEnum.PAYSTACK,
    );

    if (!paymentMethod || !paymentMethod.apiKey) {
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(paymentMethod.apiKey);

    console.log('paymentWebhook check 2');

    //validate event
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const hash = createHmac('sha512', decryptedSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    let constructedPayload: any;

    // TODO: uncomment below validation
    // if (hash == req.headers['x-paystack-signature']) {

    if (payload.event === 'charge.success') {
      console.log('paymentWebhook check 3');
      constructedPayload = {
        reference: payload.data.reference,
        paymentObject: payload,
        amountPaid: payload.data.amount / 100,
        userIdFromMetadata: payload.data.metadata.userId,
      };
    }

    return await this.paymentService.processPremiumPayment(constructedPayload);
    // } else {
    //   throw new UnprocessableEntityException('Invalid x-paystack-signature');
    // }
  }
}
