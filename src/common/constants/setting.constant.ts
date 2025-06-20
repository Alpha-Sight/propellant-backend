import { ISettings } from '../interfaces/setting.interface';
import { isDevEnvironment } from '../configs/environment';

export const SETTINGS: ISettings = {
  app: {
    name: 'Propellant',
    supportEmail: 'support@Propellant.com',
    urls: {
      webHomepage: isDevEnvironment
        ? 'https://staging.Propellant.ng'
        : 'https://Propellant.ng',
      coursesPage: isDevEnvironment
        ? 'https://staging.Propellant.ng'
        : 'https://Propellant.ng',
    },
  },
};
