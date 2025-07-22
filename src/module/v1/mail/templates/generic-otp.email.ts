import { OTP_EXPIRATION_TIME_IN_WORDS } from 'src/common/constants/otp.constant';
import { baseTemplate } from './base-template.mail';

export function OtpEmailTemplate(otpCode: number) {
  const content = `
    <p style='font-size:1.1em'>Hello,</p>
    <p>Your One-Time Password (OTP) is:</p>
    <h2 style='font-weight:bold;'>${otpCode}</h2>
    <p>This code is valid for ${OTP_EXPIRATION_TIME_IN_WORDS}. Please use it promptly.</p>
  `;

  return baseTemplate({
    title: 'Your OTP Code',
    content: content,
  });
}
