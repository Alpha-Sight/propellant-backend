import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  Logger,
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
  private readonly logger = new Logger(PremiumService.name);

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

  /**
   * Deduct credit from user account and check if they need to be downgraded
   * @param userId The user ID
   * @param points Number of points to deduct (default: 1)
   */
  async deductUserCredit(userId: string, points: number = 1) {
    this.logger.log(`[deductUserCredit] Deducting ${points} credit(s) from user ${userId}`);
    
    try {
      if (typeof userId !== 'string' || userId.includes('{')) {
        this.logger.error(`[deductUserCredit] Invalid userId format: ${userId}`);
        throw new BadRequestException('Invalid user ID format');
      }
      
      const user = await this.userService.findOneById(userId);
      if (!user) {
        this.logger.error(`[deductUserCredit] User not found: ${userId}`);
        throw new BadRequestException('User not found');
      }
      
      const currentCredits = user.totalCreditPoint || 0;
      this.logger.log(`[deductUserCredit] User ${userId} current credits: ${currentCredits}`);
      
      if (currentCredits < points) {
        this.logger.warn(`[deductUserCredit] User ${userId} doesn't have enough credits. Has: ${currentCredits}, needed: ${points}`);
        await this.checkAndDowngradeUserIfCreditsDepleted(userId);
        return false; // Not enough credits
      }
      
      // Deduct the points
      await this.userService.updateQuery(
        { _id: user._id },
        { $inc: { totalCreditPoint: -points } }
      );
      
      this.logger.log(`[deductUserCredit] Successfully deducted ${points} credit(s) from user ${userId}`);
      
      // After deducting, check if we need to downgrade
      await this.checkAndDowngradeUserIfCreditsDepleted(userId);
      
      return true;
    } catch (error) {
      this.logger.error(`[deductUserCredit] Error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if a user's credits are depleted and downgrade to free plan if needed
   * @param userId The user ID
   */
  async checkAndDowngradeUserIfCreditsDepleted(userId: string) {
    this.logger.log(`[checkAndDowngradeUserIfCreditsDepleted] Checking credits for user ${userId}`);
    
    try {
      const user = await this.userService.findOneById(userId);
      if (!user) {
        this.logger.error(`[checkAndDowngradeUserIfCreditsDepleted] User not found: ${userId}`);
        throw new BadRequestException('User not found');
      }
      
      // Check if user is on a premium plan and has no credits
      const currentCredits = user.totalCreditPoint || 0;
      const currentPlan = user.plan;
      
      this.logger.log(`[checkAndDowngradeUserIfCreditsDepleted] User ${userId} has plan: ${currentPlan}, credits: ${currentCredits}`);
      
      // If user has a premium plan but no credits left, downgrade to FREE
      if (currentPlan !== 'FREE' && currentCredits <= 0) {
        this.logger.log(`[checkAndDowngradeUserIfCreditsDepleted] Downgrading user ${userId} from ${currentPlan} to FREE plan`);
        
        const session = await this.transactionService.startSession();
        session.startTransaction();
        
        try {
          // Update the user's plan
          await this.userService.updateQuery(
            { _id: user._id },
            { plan: 'FREE' },
            session
          );
          
          // Create a transaction record for the downgrade
          await this.transactionService.create({
            user: user._id.toString(),
            totalAmount: 0, // No money involved in downgrade
            status: TransactionStatusEnum.COMPLETED,
            description: `Downgraded from ${currentPlan} to FREE due to depleted credits`,
            type: TransactionTypeEnum.PLAN_DOWNGRADE, // Using our newly added enum value
            paymentMethod: 'system',
            reference: `downgrade-${user._id}-${Date.now()}`,
            plan: 'FREE',
            metadata: {
              previousPlan: currentPlan,
              reason: 'Credits depleted'
            }
          }, session);
          
          await session.commitTransaction();
          
          // Send email notification about the downgrade
          await this.mailService.sendEmail(
            user.email,
            'Account Downgraded to Free Plan',
            `<p>Hello,</p>
            <p>Your account has been downgraded to the Free plan because you've run out of credits.</p>
            <p>To continue using premium features, please upgrade your plan again.</p>
            <p>Thank you for using our service!</p>`
          );
          
          this.logger.log(`[checkAndDowngradeUserIfCreditsDepleted] Successfully downgraded user ${userId} to FREE plan and sent email notification`);
          
          return true; // User was downgraded
        } catch (error) {
          await session.abortTransaction();
          this.logger.error(`[checkAndDowngradeUserIfCreditsDepleted] Transaction error: ${error.message}`);
          throw error;
        } finally {
          await session.endSession();
        }
      }
      
      return false; // No need to downgrade
    } catch (error) {
      this.logger.error(`[checkAndDowngradeUserIfCreditsDepleted] Error: ${error.message}`);
      throw error;
    }
  }
}
