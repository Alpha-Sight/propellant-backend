import { SubscriptionTypeEnum } from '../enums/premium.enum';

export interface ISubscriptionPlan {
  price: number;
  features: string[];
  description?: string[];
}
export interface ISettings {
  app: App;
}

export interface App {
  name: string;
  supportEmail: string;
  subscriptionPrice: {
    [key in SubscriptionTypeEnum]: ISubscriptionPlan;
  };
  urls: {
    webHomepage: string;
    waitlistPage: string;
  };
  points: {
    referral: number;
    signup: number;
    premium: number;
  };
}
