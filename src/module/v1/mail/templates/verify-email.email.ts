import { OTP_EXPIRATION_TIME_IN_WORDS } from '../../../../common/constants/otp.constant';
import { IVerifyEmailTemplate } from '../../../../common/interfaces/email-templates.interface';
import { baseTemplate } from './base-template.mail';

export function VerifyEmailTemplate(data: IVerifyEmailTemplate) {
  const content = `
  <p style='font-size:1.1em'>Hi,</p>
   <p>Verify your email with the code below. This code expires in <span style="color: #FF5733; font-weight: bold;">${OTP_EXPIRATION_TIME_IN_WORDS}</span>.</p>
   <div style="
     font-size: 32px; 
     letter-spacing: 5px; 
     text-align: center; 
     background: #E9F6E9; 
     padding: 20px; 
     border-radius: 8px; 
     margin: 20px 0; 
     color: #007B9E; 
     font-weight: bold;">
     ${data.code}
   </div>
 `;

  return baseTemplate({
    title: 'Verify Your Email',
    content: content,
  });
}

export function VerifyPhoneTemplate(data: IVerifyEmailTemplate) {
  const content = `
   <p style='font-size:1.1em'>Hi,</p>
    <p>Verify your phone number with the code below. This code expires in <span style="color: #FF5733; font-weight: bold;">${OTP_EXPIRATION_TIME_IN_WORDS}</span>.</p>
    <div style="
      font-size: 32px; 
      letter-spacing: 5px; 
      text-align: center; 
      background: #E9F6E9; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0; 
      color: #007B9E; 
      font-weight: bold;">
      ${data.code}
    </div>
  `;
  return baseTemplate({
    title: 'Verify Your Phone',
    content: content,
  });
}
