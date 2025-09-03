import { ISettings } from '../interfaces/setting.interface';
import { isDevEnvironment } from '../configs/environment';
import { SubscriptionTypeEnum } from '../enums/premium.enum';

export const SETTINGS: ISettings = {
  app: {
    name: 'Propellant HR',
    supportEmail: 'support@Propellanthr.com',
    subscriptionPrice: {
      [SubscriptionTypeEnum.FREE]: {
        price: 0,
        features: [
          'Basic profile creation',
          'Upload up to 5 credentials',
          'Basic CV generator',
          'Email support',
        ],
      },
      [SubscriptionTypeEnum.BASIC]: {
        price: 1500,
        features: ['Access to HR management tools', 'Email support'],
      },
      [SubscriptionTypeEnum.PROFESSIONAL]: {
        price: 5000,
        features: [
          'Enhanced profile with portfolio',
          'Unlimited credential uploads',
          'AI-powered CV optimization',
          'Unlimited CV downloads',
          'NFT skill badges',
          'Priority verification',
          'Advanced analytics',
          'Priority support',
        ],
      },
      [SubscriptionTypeEnum.ENTERPRISE]: {
        price: 15000,
        features: [
          'All PROFESSIONAL features',
          'Custom integrations',
          'Dedicated account manager',
        ],
      },
      [SubscriptionTypeEnum.PREMIUM]: {
        price: 10000,
        features: [
          'All PROFESSIONAL features',
          'Personal brand building tools',
          'Advanced recommendation engine',
          'Multiple CV templates',
          'Interview preparation tools',
          'Career coaching sessions',
          'Premium support',
          'API access',
        ],
      },
    },
    urls: {
      webHomepage: isDevEnvironment
        ? 'https://propellanthr.com'
        : 'https://Propellant.ng',
      waitlistPage: isDevEnvironment
        ? 'https://propellanthr.com'
        : 'https://Propellant.ng',
    },
    points: {
      referral: 1,
      signup: 3,
      premium: 5,
    },
  },
};
