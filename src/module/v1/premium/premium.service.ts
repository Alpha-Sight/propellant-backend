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
import { MailService } from '../mail/mail.service';
import { premiumPlanNotificationEmailTemplate } from '../mail/templates/premium.email';
import { SelectPlanDto } from './dto/premium.dto';
import { SettingService } from '../setting/setting.service';
import { ISettings } from 'src/common/interfaces/setting.interface';
import { SETTINGS } from 'src/common/constants/setting.constant';
import { BaseHelper } from 'src/common/utils/helper/helper.util';

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
    plan: string,
  ) {
    const user = await this.userService.findOneById(userId);
    if (!user) throw new BadRequestException('Invalid user metadata');

    const session = await this.transactionService.startSession();
    session.startTransaction();

    try {
      // 1. Update user plan
      await this.userService.updateQuery({ _id: user._id }, { plan }, session);

      // 2. Award points
      const { premium: premiumPoint } = SETTINGS.app.points;
      await this.userService.updateQuery(
        { _id: user._id },
        { $inc: { premiumPoint } },
        session, // ✅ use same session
      );

      // 3. Commit
      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      await session.endSession();
    }

    // ✅ Non-transactional things should be outside
    await Promise.all([
      this.mailService.sendEmail(
        user.email,
        'Subscription upgraded successfully',
        premiumPlanNotificationEmailTemplate({
          user: [user.email.split('@')[0]],
          reference: paymentObject.data.reference || 'N/A',
          upgradeDate: new Date().toLocaleDateString(),
          totalAmount: paymentObject.data.amount,
          currencySymbol: paymentObject.data.currency,
          plan,
        }),
      ),
      this.mailService.sendEmail(
        'propellant@gmail.com',
        'New Plan Subscription',
        premiumPlanNotificationEmailTemplate({
          user: [user.email.split('@')[0]],
          reference: paymentObject.data.reference || 'N/A',
          upgradeDate: new Date().toLocaleDateString(),
          totalAmount: paymentObject.data.amount,
          currencySymbol: paymentObject.data.currency,
          plan,
        }),
      ),
    ]);
    return {
      message: 'User upgraded successfully',
      plan,
      amountPaid,
      reference: paymentObject?.data?.reference || 'N/A',
    };
  }

  async selectPlan(user: UserDocument, payload: SelectPlanDto) {
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (payload.plan === 'FREE') {
      // If the user selects the free plan, update their plan and return
      await this.userService.update(user._id.toString(), {
        plan: 'FREE',
      });
      return {
        message: 'You have successfully selected the free plan.',
        plan: 'FREE',
      };
    }

    if (user.plan === payload.plan) {
      throw new BadRequestException(
        `You are already on the ${payload.plan} plan.`,
      );
    }
    // If the user selects a paid plan, proceed with payment initialization

    const settings = (await this.settingService.getSettings()) as ISettings;
    const subscriptionPriceMap = Object.fromEntries(
      (settings?.app?.subscriptionPlans || []).map((plan) => [
        plan.name,
        plan.price,
      ]),
    );

    const selectedPlan = payload.plan;

    const planAmount = subscriptionPriceMap?.[selectedPlan];

    if (planAmount === undefined) {
      throw new NotFoundException(
        `${selectedPlan} pricing not configured for this plan. Please contact support.`,
      );
    }

    const transaction = await this.transactionService.create({
      user: user._id.toString(),
      totalAmount: planAmount,
      status: TransactionStatusEnum.PENDING,
      description: `Upgrade to ${selectedPlan}`,
      type: TransactionTypeEnum.SUBSCRIPTION,
      paymentMethod: 'paystack',
      reference: BaseHelper.generateRandomString(),
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
    plan: string,
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
              reference,
              amount,
              email: user.email,
              metadata: {
                userId: user._id.toString(),
                plan,
                upgradeType: plan,
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
