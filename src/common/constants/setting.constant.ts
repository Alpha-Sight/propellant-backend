import { ISettings } from '../interfaces/setting.interface';
import { isDevEnvironment } from '../configs/environment';

export const SETTINGS: ISettings = {
  app: {
    name: 'Propellant HR',
    supportEmail: 'support@Propellanthr.com',
    price: {
      premiumPricing: 1000,
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
