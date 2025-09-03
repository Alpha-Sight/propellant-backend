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
import { SubscriptionTypeEnum } from 'src/common/enums/premium.enum';
import { MailService } from '../mail/mail.service';
import { premiumPlanNotificationEmailTemplate } from '../mail/templates/premium.email';
import { SelectPlanDto } from './dto/premium.dto';
import { SettingService } from '../setting/setting.service';
import { ISettings } from 'src/common/interfaces/setting.interface';
import { SETTINGS } from 'src/common/constants/setting.constant';

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
    plan: SubscriptionTypeEnum,
  ) {
    const user = await this.userService.findOneById(userId);

    if (!user) {
      throw new BadRequestException(
        'Invalid payment metadata: missing user or plan',
      );
    }

    console.log('Processing upgrade for:', { user, plan, amountPaid });

    // Create or find a pending transaction for the premium upgrade
    let transaction = await this.transactionService.findOneQuery({
      options: {
        user: userId,
        plan,
        type: TransactionTypeEnum.SUBSCRIPTION,
        status: TransactionStatusEnum.PENDING,
      },
    });

    // if (!transaction) {
    //   throw new BadRequestException(
    //     'User does not have a premium subscription',
    //   );
    // }

    if (!transaction) {
      transaction = await this.transactionService.create({
        user: userId,
        status: TransactionStatusEnum.PENDING,
        totalAmount: paymentObject.amount,
        description: 'subscription plan subscription payment',
        type: TransactionTypeEnum.SUBSCRIPTION,
        plan: plan,
        metadata: paymentObject,
        settlement: 0,
        paymentMethod: paymentObject?.provider,
        reference: `upgrade-${user._id}-${Date.now()}`,
      });
      if (!transaction) {
        return;
      }
    }
    console.log('transaction', transaction);
    let sessionCommitted = false;
    const session = await this.transactionService.startSession();
    session.startTransaction();

    try {
      await this.userService.update(
        user._id.toString(),
        {
          plan,
        },
        // session,
      );
      await this.transactionService.updateQuery(
        { _id: transaction._id },
        {
          status: TransactionStatusEnum.COMPLETED,
        },
        session,
      );

      await session.commitTransaction();
      sessionCommitted = true;

      const { premium: premiumPoint } = SETTINGS.app.points;

      await this.userService.updateQuery(
        { _id: user._id },
        {
          $inc: {
            premiumPoint: premiumPoint,
          },
        },
      );

      // Send email notifications for successful upgrade
      await Promise.all([
        this.mailService.sendEmail(
          user.email,
          'Subscription plan Successfully upgraded',
          premiumPlanNotificationEmailTemplate({
            user: [user.email.split('@')[0]],
            reference: transaction._id.toString(),
            upgradeDate: new Date().toLocaleDateString(),
            totalAmount: amountPaid,
            currencySymbol: '₦',
            plan,
          }),
        ),
        this.mailService.sendEmail(
          'propellant@gmail.com',
          'New Plan Subscription',
          premiumPlanNotificationEmailTemplate({
            user: [user.email.split('@')[0]],
            reference: transaction._id.toString(),
            upgradeDate: new Date().toLocaleDateString(),
            totalAmount: amountPaid,
            currencySymbol: '₦',
            plan,
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

    if (payload.plan === SubscriptionTypeEnum.FREE) {
      // If the user selects the free plan, update their plan and return
      await this.userService.update(user._id.toString(), {
        plan: SubscriptionTypeEnum.FREE,
      });
      return {
        message: 'You have successfully selected the free plan.',
        plan: SubscriptionTypeEnum.FREE,
      };
    }
    // If the user selects a paid plan, proceed with payment initialization

    const settings = (await this.settingService.getSettings()) as ISettings;
    const subscriptionPriceMap = Object.fromEntries(
      Object.entries(settings?.app?.subscriptionPrice || {}).map(
        ([plan, details]) => [plan, details.price],
      ),
    );

    const selectedPlan = payload.plan;

    const planAmount = subscriptionPriceMap?.[selectedPlan];

    if (planAmount === undefined) {
      throw new NotFoundException(
        `${selectedPlan} pricing not configured. Please contact support.`,
      );
    }

    const transaction = await this.transactionService.create({
      user: user._id.toString(),
      totalAmount: planAmount,
      status: TransactionStatusEnum.PENDING,
      description: `Upgrade to ${selectedPlan}`,
      type: TransactionTypeEnum.SUBSCRIPTION,
      paymentMethod: 'paystack',
      reference: `upgrade-${user._id}-${Date.now()}`,
      plan: selectedPlan,
    });

    return this.constructPaymentPayloadForUpgrade(
      user,
      Number(planAmount),
      payload.plan,
      transaction.reference,
    );
  }

  async constructPaymentPayloadForUpgrade(
    user: UserDocument,
    amount: number,
    plan: SubscriptionTypeEnum,
    reference: string,
  ) {
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
                userId: user._id.toString(),
                plan,
                upgradeType: 'premium',
                transactionId: `txn-${user._id}-${Date.now()}`, // optional
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
