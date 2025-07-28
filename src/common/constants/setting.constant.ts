import { ISettings } from '../interfaces/setting.interface';
import { isDevEnvironment } from '../configs/environment';
import { SubscriptionTypeEnum } from '../enums/premium.enum';

export const SETTINGS: ISettings = {
  app: {
    name: 'Propellant HR',
    supportEmail: 'support@Propellanthr.com',
    subscriptionPrice: {
      [SubscriptionTypeEnum.BASIC]: 49,
      [SubscriptionTypeEnum.PROFESSIONAL]: 99,
      [SubscriptionTypeEnum.ENTERPRISE]: 199,
      [SubscriptionTypeEnum.FREE]: 0,
      [SubscriptionTypeEnum.PREMIUM]: 59,
    },
    urls: {
      webHomepage: isDevEnvironment
        ? 'https://propellanthr.com'
        : 'https://Propellant.ng',
      waitlistPage: isDevEnvironment
        ? 'https://propellanthr.com'
        : 'https://Propellant.ng',
    },
  },
};
