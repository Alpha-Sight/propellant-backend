import { ISendResetPasswordEmailTemplate } from '../../../../common/interfaces/email-templates.interface';
import { baseTemplate } from './base-template.mail';

export function ForgotPasswordTemplate(data: ISendResetPasswordEmailTemplate) {
  const content = `
    <p style='font-size:1.1em'>Hi,</p>
    <p>This is the code to reset your password. This code
      <b>expires</b>
      in 5 minutes</p>
    <h2
      style='margin: 0 auto;width: max-content;padding: 0 10px;color: #000;border-radius: 4px; letter-spacing: 4px;'
    >${data.code}</h2>
  `;

  return baseTemplate({
    title: 'Reset Your Password',
    content,
  });
}
