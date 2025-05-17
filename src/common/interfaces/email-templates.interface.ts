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
