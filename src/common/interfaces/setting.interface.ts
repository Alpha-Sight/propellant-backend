export interface ISubscriptionPlan {
  name: string;
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
  subscriptionPlans: ISubscriptionPlan[];
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
