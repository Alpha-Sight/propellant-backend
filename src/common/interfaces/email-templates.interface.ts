import { WaitlistInterestEnum } from '../enums/waitlist.enum';

export interface IWelcomeEmailTemplate {
  name: string;
}

export interface IVerifyEmailTemplate {
  code: number;
}

export type ISendResetPasswordEmailTemplate = IVerifyEmailTemplate;

export interface IGenericOtpEmailTemplate {
  message: string;
  code: number;
  expirationTime: number;
}

export interface IWaitlistEmailTemplate {
  fullName: string;
  interest: WaitlistInterestEnum | WaitlistInterestEnum[];
  appName?: string;
}
