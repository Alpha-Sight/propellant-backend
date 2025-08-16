import { SubscriptionTypeEnum } from '../enums/premium.enum';

export interface ISettings {
  app: App;
}

export interface App {
  name: string;
  supportEmail: string;
  subscriptionPrice: {
    [key in SubscriptionTypeEnum]: number;
  };
  urls: {
    webHomepage: string;
    waitlistPage: string;
  };
  points: {
    referral: number;
    signup: number;
  };
}
