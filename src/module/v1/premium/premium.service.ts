import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserService } from '../user/services/user.service';
import {
  TransactionStatusEnum,
  TransactionTypeEnum,
} from 'src/common/enums/transaction.enum';
import { TransactionService } from '../transaction/transaction.service';

import {
  IBaseInitializePayment,
  IFlutterwaveInitializePayment,
} from 'src/common/interfaces/payment.interface';
import { UserDocument } from '../user/schemas/user.schema';
import { PaymentService } from '../payment/services/payment.service';
import { PaymentProvidersEnum } from 'src/common/enums/payment.enum';
import { PlanTypeEnum } from 'src/common/enums/premium.enum';
import { MailService } from '../mail /mail.service';
import { premiumPlanNotificationEmailTemplate } from '../mail /templates/premium.email';
import { SelectPlanDto } from './dto/premium.dto';
import { SettingService } from '../setting/setting.service';
import { ISettings } from 'src/common/interfaces/setting.interface';

@Injectable()
export class PremiumService {
  constructor(
    private userService: UserService,
    private mailService: MailService,
    private transactionService: TransactionService,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    private settingService: SettingService,
  ) {}

  async upgradeToPremium(
    userId: string,
    amountPaid: number,
    paymentObject: any,
  ) {
    const user = await this.userService.findOneById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.plan === PlanTypeEnum.PREMIUM) {
      throw new BadRequestException('User already has premium subscription');
    }

    // Create or find a pending transaction for the premium upgrade
    let transaction = await this.transactionService.findOneQuery({
      options: {
        user: userId,
        type: TransactionTypeEnum.Premium,
        status: TransactionStatusEnum.PENDING,
      },
    });

    if (!transaction) {
      throw new BadRequestException(
        'User does not have a premium subscription',
      );
    }

    if (!transaction) {
      transaction = await this.transactionService.create({
        user: userId,
        status: TransactionStatusEnum.PENDING,
        totalAmount: 1000,
        description: 'premium plan subscription payment',
        type: TransactionTypeEnum.Premium,
        metadata: paymentObject,
        settlement: 0,
        paymentMethod: paymentObject?.provider,
      });
      if (!transaction) {
        return;
      }
    }

    let sessionCommitted = false;
    const session = await this.transactionService.startSession();
    session.startTransaction();

    try {
      await this.userService.update(user._id.toString(), {
        plan: PlanTypeEnum.PREMIUM,
      });
      await this.transactionService.updateQuery(
        { _id: transaction._id },
        {
          status: TransactionStatusEnum.COMPLETED,
        },
        session,
      );

      await session.commitTransaction();
      sessionCommitted = true;

      // Send email notifications for successful upgrade
      await Promise.all([
        this.mailService.sendEmail(
          user.email,
          'Premium plan Successful',
          premiumPlanNotificationEmailTemplate({
            user: [user.email.split('@')[0]],
            reference: transaction._id.toString(),
            upgradeDate: new Date().toLocaleDateString(),
            totalAmount: amountPaid / 1000,
            currencySymbol: '₦',
          }),
        ),
        this.mailService.sendEmail(
          'propellant@gmail.com',
          'New Premium Subscription',
          premiumPlanNotificationEmailTemplate({
            user: [user.email.split('@')[0]],
            reference: transaction._id.toString(),
            upgradeDate: new Date().toLocaleDateString(),
            totalAmount: amountPaid / 1000,
            currencySymbol: '₦',
          }),
        ),
      ]);

      return transaction;
    } catch (error) {
      if (!sessionCommitted) {
        await session.abortTransaction();
      }
    } finally {
      await session.endSession();
    }
  }

  async selectPlan(user: UserDocument, payload: SelectPlanDto) {
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user selects the free/standard plan, just update and return
    if (payload.plan === PlanTypeEnum.REGULAR) {
      await this.userService.update(user._id.toString(), {
        plan: PlanTypeEnum.REGULAR,
      });

      return {
        message: 'User has been set to Regular plan successfully.',
      };
    }

    // If premium is selected, get pricing and initiate payment
    const settings = (await this.settingService.getSettings()) as ISettings;
    const premiumPricing = settings?.app?.price.premiumPricing;

    if (!premiumPricing) {
      throw new NotFoundException(
        'Premium pricing not configured. Please contact support.',
      );
    }

    return this.constructPaymentPayloadForUpgrade(user, Number(premiumPricing));
  }
  // async initiatePremiumUpgrade(user: UserDocument) {

  //   const paymentUrl =
  //     await this.paymentService.initializePaymentByActiveProvider({
  //       reference: `upgrade-${user._id}-${Date.now()}`,
  //       amount: premiumPricing,
  //       email: user.email,
  //       metadata: {
  //         user: user._id.toString(),
  //         upgradeType: 'premium',
  //       },
  //     });

  //   return { paymentUrl };
  // }

  async constructPaymentPayloadForUpgrade(user: UserDocument, amount: number) {
    const activePaymentProvider = await this.paymentService.findOneQuery({
      options: { active: true },
    });

    console.log('activePaymentProvider ', activePaymentProvider);

    if (!activePaymentProvider) {
      throw new NotFoundException('No active payment provider found');
    }

    let paymentUrl: string;
    switch (activePaymentProvider.name) {
      case PaymentProvidersEnum.PAYSTACK:
        paymentUrl =
          await this.paymentService.initializePaymentByPaymentProvider(
            activePaymentProvider.name as PaymentProvidersEnum,
            {
              reference: `upgrade-${user._id}-${Date.now()}`,
              amount,
              email: user.email,
              metadata: {
                user: user._id.toString(),
                upgradeType: 'premium',
              },
            } as IBaseInitializePayment,
          );
        break;
      case PaymentProvidersEnum.FLUTTERWAVE:
        paymentUrl =
          await this.paymentService.initializePaymentByPaymentProvider(
            activePaymentProvider.name as PaymentProvidersEnum,
            {
              tx_ref: `upgrade-${user._id}-${Date.now()}`,
              amount,
              currency: 'NGN',
              redirect_url: null,
              meta: {
                userId: user._id.toString(),
                upgradeType: 'premium',
              },
              customer: {
                email: user.email,
              },
            } as IFlutterwaveInitializePayment,
          );
        break;
      default:
        throw new UnprocessableEntityException(
          'Unable to process payment, please try again later.',
        );
    }

    return paymentUrl;
  }
}
