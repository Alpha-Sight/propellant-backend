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
import { TransactionStatusEnum, TransactionTypeEnum } from 'src/common/enums/transaction.enum';
import { TransactionService } from '../../transaction/transaction.service';
import { PremiumService } from '../../premium/premium.service';
import {
  IBaseInitializePayment,
  IInitializePaymentResponse,
} from 'src/common/interfaces/payment.interface';
import { IPaystackPaymentWebhook } from 'src/common/interfaces/paystack.interface';
import { BaseHelper } from 'src/common/utils/helper/helper.util';

@Injectable()
export class PaystackService {
  private readonly apiKey = ENVIRONMENT.PAYSTACK.API_KEY;

  constructor(
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    private httpService: HttpService,
    @Inject(forwardRef(() => TransactionService))
    private transactionService: TransactionService,
    @Inject(forwardRef(() => PremiumService))
    private premiumService: PremiumService,
  ) {}

  async initializePayment(
    payload: IBaseInitializePayment,
  ): Promise<IInitializePaymentResponse> {
    const paystackPaymentMethod =
      await this.paymentService.getPaymentMethodByName(
        PaymentProvidersEnum.PAYSTACK,
      );

    console.log('paystackPaymentMethod', paystackPaymentMethod);

    if (!paystackPaymentMethod || !this.apiKey) {
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(this.apiKey);

    try {
      // Set default callback_url if not provided
      const frontendUrl = ENVIRONMENT.FRONTEND.URL || 'https://propellanthr.com';
      const callback_url = payload.callback_url || `${frontendUrl}/payment/success`;
      
      const res = await this.httpService.axiosRef.post(
        `${ENVIRONMENT.PAYSTACK.HOST}/transaction/initialize`,
        {
          ...payload,
          amount: payload.amount * 100,
          callback_url, // Ensure callback_url is included in the request
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

  async verifyPayment(reference: string) {
    try {
      const paystackPaymentMethod =
        await this.paymentService.getPaymentMethodByName(
          PaymentProvidersEnum.PAYSTACK,
        );

      if (!paystackPaymentMethod || !this.apiKey) {
        throw new NotFoundException('Payment method not found');
      }

      const decryptedSecret = BaseHelper.decryptData(this.apiKey);
      
      const response = await this.httpService.axiosRef.get(
        `${ENVIRONMENT.PAYSTACK.HOST}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${decryptedSecret}`,
            'Content-Type': 'application/json',
          },
        },
      );
      
      if (response.data.status && response.data.data.status === 'success') {
        // Find the transaction by reference
        const transaction = await this.transactionService.findOneQuery({
          options: { reference },
        });
        
        if (transaction) {
          // Update transaction status
          await this.transactionService.updateQuery(
            { reference },
            { status: TransactionStatusEnum.COMPLETED },
          );
          
          // If this is a premium subscription, upgrade the user
          if (
            transaction.type === TransactionTypeEnum.SUBSCRIPTION &&
            transaction.plan
          ) {
            await this.premiumService.upgradeToPremium(
              transaction.user.toString(),
              transaction.totalAmount,
              response.data,
              transaction.plan,
            );
          }
          
          return {
            success: true,
            message: 'Payment verification successful',
            data: response.data.data,
          };
        } else {
          return {
            success: false,
            message: 'No transaction found with this reference',
          };
        }
      } else {
        return {
          success: false,
          message: 'Payment verification failed',
          data: response.data,
        };
      }
    } catch (error) {
      console.error('verifyPayment error:', error);
      throw new BadRequestException(
        error?.message ?? 'Unable to verify payment',
      );
    }
  }

  async paymentWebhook(req: Request, payload: IPaystackPaymentWebhook) {
    console.log('paymentWebhook check 1 ');
    const paystackPaymentMethod =
      await this.paymentService.getPaymentMethodByName(
        PaymentProvidersEnum.PAYSTACK,
      );

    if (!paystackPaymentMethod || !this.apiKey) {
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(this.apiKey);

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
          amountPaid: payload.data.amount / 100, // convert from kobo
          userIdFromMetadata: payload.data.metadata.userId,
          plan: payload.data.metadata.plan,
        };
      }
      console.log('constructedPayload', constructedPayload);
      console.log('paymentWebhook check success');

      return await this.paymentService.processPremiumPayment(
        constructedPayload,
      );
    } else {
      console.error('Invalid x-paystack-signature');
    }
  }
}
