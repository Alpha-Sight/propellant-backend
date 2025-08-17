import { ISettings } from '../interfaces/setting.interface';
import { isDevEnvironment } from '../configs/environment';
import { SubscriptionTypeEnum } from '../enums/premium.enum';

export const SETTINGS: ISettings = {
  app: {
    name: 'Propellant HR',
    supportEmail: 'support@Propellanthr.com',
    subscriptionPrice: {
      [SubscriptionTypeEnum.BASIC]: 1500,
      [SubscriptionTypeEnum.PROFESSIONAL]: 1500,
      [SubscriptionTypeEnum.ENTERPRISE]: 1500,
      [SubscriptionTypeEnum.FREE]: 0,
      [SubscriptionTypeEnum.PREMIUM]: 1500,
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
    },
  },
};
