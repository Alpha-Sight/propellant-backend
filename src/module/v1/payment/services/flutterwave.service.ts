import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ENVIRONMENT } from '../../../../common/configs/environment';
import { Request } from 'express';
import { PaymentProvidersEnum } from 'src/common/enums/payment.enum';
import { IFlutterwaveWebhookPayload } from 'src/common/interfaces/flutterwave.interface';
import { IFlutterwaveInitializePayment } from 'src/common/interfaces/payment.interface';
import { BaseHelper } from 'src/common/utils/helper/helper.util';

@Injectable()
export class FlutterwaveService {
  constructor(
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    private httpService: HttpService,
  ) {}

  async initializePayment(payload: IFlutterwaveInitializePayment) {
    try {
      console.log('payload', payload);

      const decryptedSecret = await this.getApiKey();

      const res = await this.httpService.axiosRef.post(
        `${ENVIRONMENT.FLUTTERWAVE.HOST}/v3/payments`,
        {
          ...payload,
          redirect_url:
            'http://localhost:4999/api/flutterwave/process/internal/callback',
        },
        {
          headers: {
            Authorization: `Bearer ${decryptedSecret}`,
          },
        },
      );

      console.log('initialize flutterwave payment response', res?.data);

      return res?.data?.data?.link || null;
    } catch (error) {
      console.log('initialize flutterwave payment error', error);
      throw new BadRequestException('Unable to initialize payment');
    }
  }

  async handleFlutterwaveWebhook(
    req: Request,
    payload: IFlutterwaveWebhookPayload,
  ) {
    const secret = req.headers['verif-hash'];

    // TODO: this would be encrypted in production so we would decrypt it
    if (!secret || secret !== ENVIRONMENT.FLUTTERWAVE.WEBHOOK_SECRET) {
      return;
    }

    if (payload?.event === 'charge.completed') {
      await this.verifyTransactionStatus(payload?.data?.id);
    }
  }

  async handleFlutterwaveCallback(txId: number) {
    await this.verifyTransactionStatus(txId);
  }

  async verifyTransactionStatus(txId: number) {
    try {
      const decryptedSecret = await this.getApiKey();

      const response = await this.httpService.axiosRef.get(
        `${ENVIRONMENT.FLUTTERWAVE.HOST}/v3/transactions/${txId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${decryptedSecret}`,
          },
        },
      );

      console.log('response', response?.data);

      if (response?.data?.status !== 'success') {
        throw new NotFoundException('Transaction not found');
      }

      const event = response?.data;

      const constructedPayload = {
        transactionId: event.data.meta.Id,
        reference: event.data.tx_ref,
        paymentObject: event,
        amountPaid: event.data.amount,
        userId: event.data.meta.userId,
        plan: event.data.plan,
      };

      return await this.paymentService.processPremiumPayment(
        constructedPayload,
      );
    } catch (error) {
      console.log('verifyTransactionStatus error', error);
      throw new BadRequestException(
        error?.message ?? 'Unable to verify transaction status',
      );
    }
  }

  async getApiKey() {
    const flutterwavePaymentMethod =
      await this.paymentService.getPaymentMethodByName(
        PaymentProvidersEnum.FLUTTERWAVE,
      );

    if (!flutterwavePaymentMethod?.apiKey) {
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(
      flutterwavePaymentMethod.apiKey,
    );

    return decryptedSecret;
  }
}
