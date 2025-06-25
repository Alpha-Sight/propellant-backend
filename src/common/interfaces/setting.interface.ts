export interface ISettings {
  app: App;
}

export interface App {
  name: string;
  supportEmail: string;
  price: {
    premiumPricing: number;
  };
  urls: {
    webHomepage: string;
    waitlistPage: string;
  };
}
