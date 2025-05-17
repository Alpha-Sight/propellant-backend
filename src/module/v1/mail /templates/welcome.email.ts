import { IWelcomeEmailTemplate } from 'src/common/interfaces/email-templates.interface';
import { baseTemplate } from './base-template.mail';

export function welcomeEmailTemplate(data: IWelcomeEmailTemplate) {
  const content = `
  <h1>Welcome, ${data.name}!</h1>
  <p>Thank you for joining our platform. We are excited to have you on board.</p>
  <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
    `;

  return baseTemplate({
    title: 'Welcome to our platform',
    content,
  });
}
