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
  ) {
    console.log('PaystackService initialized with:');
    console.log('- PaymentService:', !!paymentService);
    console.log('- HttpService:', !!httpService);
    console.log('- TransactionService:', !!transactionService);
    console.log('- PremiumService:', !!premiumService);
    console.log('- API Key exists:', !!this.apiKey);
  }

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
          currency: "NGN", // Always use NGN (Naira) currency
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
    console.log('verifyPayment called for reference:', reference);
    try {
      const paystackPaymentMethod =
        await this.paymentService.getPaymentMethodByName(
          PaymentProvidersEnum.PAYSTACK,
        );

      if (!paystackPaymentMethod || !this.apiKey) {
        console.error('Payment method not found or API key missing');
        throw new NotFoundException('Payment method not found');
      }

      const decryptedSecret = BaseHelper.decryptData(this.apiKey);
      
      console.log('Making API call to Paystack to verify payment');
      const response = await this.httpService.axiosRef.get(
        `${ENVIRONMENT.PAYSTACK.HOST}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${decryptedSecret}`,
            'Content-Type': 'application/json',
          },
        },
      );
      
      console.log('Paystack verification response status:', response.data.status);
      console.log('Payment status:', response.data.data.status);
      
      if (response.data.status && response.data.data.status === 'success') {
        // Find the transaction by reference
        console.log('Looking for transaction with reference:', reference);
        const transaction = await this.transactionService.findOneQuery({
          options: { reference },
        });
        
        console.log('Transaction found:', !!transaction);
        
        if (transaction) {
          console.log('Updating transaction status to COMPLETED');
          // Update transaction status
          await this.transactionService.updateQuery(
            { reference },
            { 
              status: TransactionStatusEnum.COMPLETED,
              approvedAt: new Date(),
              metadata: response.data,
            },
          );
          
          // If this is a premium subscription, upgrade the user
          console.log('Transaction type:', transaction.type);
          console.log('Has plan?', !!transaction.plan);
          
          if (
            transaction.type === TransactionTypeEnum.SUBSCRIPTION &&
            transaction.plan
          ) {
            console.log('Upgrading user to premium');
            try {
              await this.premiumService.upgradeToPremium(
                transaction.user.toString(),
                transaction.totalAmount,
                response.data,
                transaction.plan,
              );
              console.log('User successfully upgraded to premium');
            } catch (upgradeError) {
              console.error('Error upgrading user to premium:', upgradeError);
              throw new BadRequestException('Error upgrading user plan: ' + upgradeError.message);
            }
          }
          
          return {
            success: true,
            message: 'Payment verification successful',
            data: response.data.data,
          };
        } else {
          console.error('Transaction not found for reference:', reference);
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
    console.log('[PaystackService] Payment webhook received');
    console.log(`[PaystackService] Event type: ${payload.event}`);
    
    const paystackPaymentMethod =
      await this.paymentService.getPaymentMethodByName(
        PaymentProvidersEnum.PAYSTACK,
      );

    if (!paystackPaymentMethod || !this.apiKey) {
      console.error('[PaystackService] Payment method not found or API key missing');
      throw new NotFoundException('Payment method not found');
    }

    const decryptedSecret = BaseHelper.decryptData(this.apiKey);

    console.log('[PaystackService] Validating webhook signature');

    //validate event
    const hash = createHmac('sha512', decryptedSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    let constructedPayload: any;

    if (hash == req.headers['x-paystack-signature']) {
      console.log('[PaystackService] Webhook signature valid');
      
      if (payload.event === 'charge.success') {
        console.log('[PaystackService] Processing successful charge');
        console.log(`[PaystackService] Customer email: ${payload.data?.customer?.email}`);
        console.log(`[PaystackService] Amount: ${payload.data.amount/100} ${payload.data.currency}`);
        console.log(`[PaystackService] Reference: ${payload.data.reference}`);

        constructedPayload = {
          transactionId: payload.data.metadata.transactionId,
          reference: payload.data.reference,
          paymentObject: payload,
          amountPaid: payload.data.amount / 100, // convert from kobo
          userIdFromMetadata: payload.data.metadata.userId,
          plan: payload.data.metadata.plan,
        };
        
        console.log('[PaystackService] User ID from metadata:', payload.data.metadata.userId);
        console.log('[PaystackService] Plan from metadata:', payload.data.metadata.plan);
      }
      
      if (constructedPayload) {
        try {
          console.log('[PaystackService] Forwarding to premium payment processor');
          const result = await this.paymentService.processPremiumPayment(
            constructedPayload,
          );
          console.log('[PaystackService] Premium payment process completed:', result);
          return result;
        } catch (error) {
          console.error('[PaystackService] Error processing premium payment webhook:', error);
          console.error(error.stack);
          throw new BadRequestException('Failed to process payment webhook: ' + error.message);
        }
      } else {
        console.log('[PaystackService] No payload constructed, event not handled');
        return { message: 'Event received but not processed' };
      }
    } else {
      console.error('Invalid x-paystack-signature');
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
