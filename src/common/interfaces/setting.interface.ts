export interface ISettings {
  app: App;
}

export interface App {
  name: string;
  supportEmail: string;
  urls: {
    webHomepage: string;
    coursesPage: string;
  };
}
