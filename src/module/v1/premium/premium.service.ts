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
    console.log(`[PremiumService] Upgrading user ${userId} to ${plan} plan`);
    
    // Handle case where userId might be an object or string representation of an object
    if (typeof userId !== 'string' || userId.includes('{')) {
      console.error(`[PremiumService] Invalid userId format received:`, userId);
      throw new BadRequestException('Invalid user ID format');
    }
    
    // Remove any unwanted characters if userId is malformed
    if (userId.includes('"') || userId.includes("'")) {
      console.log('[PremiumService] Cleaning malformed user ID');
      userId = userId.replace(/['"]/g, '');
    }
    
    const user = await this.userService.findOneById(userId);
    if (!user) throw new BadRequestException('Invalid user metadata');
    
    console.log(`[PremiumService] User found: ${user.email}, current plan: ${user.plan}, current credits: ${user.totalCreditPoint || 0}`);

    // Check if user already has the plan and premium points
    if (user.plan === plan) {
      console.log(`[PremiumService] User already has plan ${plan} - checking if credits were added`);
      
      // If user already has 8 points (3 signup + 5 premium), they were already upgraded
      if (user.totalCreditPoint >= 8) {
        console.log(`[PremiumService] User already has ${user.totalCreditPoint} credits - skipping upgrade`);
        return {
          message: 'User already upgraded',
          plan,
          amountPaid,
          reference: paymentObject?.data?.reference || 'N/A',
        };
      }
    }
    
    const session = await this.transactionService.startSession();
    session.startTransaction();

    try {
      // 1. Update user plan
      await this.userService.updateQuery({ _id: user._id }, { plan }, session);

      // 2. Award points
      const { premium: premiumPoint } = SETTINGS.app.points;
      await this.userService.updateQuery(
        { _id: user._id },
        { $inc: { totalCreditPoint: premiumPoint } },
        session, // ✅ use same session
      );

      // 3. Commit
      await session.commitTransaction();
      
      // Fetch updated user to verify changes
      const updatedUser = await this.userService.findOneById(userId);
      console.log(`[PremiumService] User upgraded successfully: ${updatedUser.email}`);
      console.log(`[PremiumService] New plan: ${updatedUser.plan}, new credits: ${updatedUser.totalCreditPoint || 0}`);
      console.log(`[PremiumService] Added ${premiumPoint} credits to user account`);
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      console.error(`[PremiumService] Error upgrading user: ${error.message}`);
      console.error(error.stack);
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
          totalAmount: paymentObject.data.amount / 100, // Convert from kobo to Naira
          currencySymbol: '₦', // Always use Naira symbol
          plan,
        }),
      ),
      this.mailService.sendEmail(
        'hrpropellant@gmail.com',
        'New Plan Subscription',
        premiumPlanNotificationEmailTemplate({
          user: [user.email.split('@')[0]],
          reference: paymentObject.data.reference || 'N/A',
          upgradeDate: new Date().toLocaleDateString(),
          totalAmount: paymentObject.data.amount / 100, // Convert from kobo to Naira
          currencySymbol: '₦', // Always use Naira symbol
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

    if (payload.plan === 'FREE' || payload.plan === 'FREEMIUM') {
      // If the user selects a free plan, update their plan and return
      await this.userService.update(user._id.toString(), {
        plan: payload.plan,
      });
      return {
        message: `You have successfully selected the ${payload.plan.toLowerCase()} plan.`,
        plan: payload.plan,
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
