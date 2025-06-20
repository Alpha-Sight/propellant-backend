import { baseTemplate } from './base-template.mail';
import { EMAIL_CONSTANT } from '../../../../common/constants/email.constant';
import { WaitlistInterestEnum } from 'src/common/enums/waitlist.enum';
import { IWaitlistEmailTemplate } from 'src/common/interfaces/email-templates.interface';

export function waitlistConfirmationEmailTemplate(
  data: IWaitlistEmailTemplate,
) {
  const { interest } = data;

  const interests = Array.isArray(interest) ? interest : [interest];

  return unifiedWaitlistConfirmationTemplate({ ...data, interest: interests });
}

export function unifiedWaitlistConfirmationTemplate(
  data: IWaitlistEmailTemplate & { interest: WaitlistInterestEnum[] },
) {
  const { fullName, interest } = data;

  const interestMap: Record<WaitlistInterestEnum, string> = {
    [WaitlistInterestEnum.TALENT]: 'Becoming a Talent',
    [WaitlistInterestEnum.ORGANIZATION]: 'Joining as an Organization',
    [WaitlistInterestEnum.INVESTOR]: 'Investing in Us',
    [WaitlistInterestEnum.VOLUNTEER]: 'Volunteering',
    [WaitlistInterestEnum.BETA_TESTER]: 'Becoming a Beta Tester',
    [WaitlistInterestEnum.AMBASSADOR]: 'Becoming an Ambassador',
  };

  const interestItems = interest
    .map((i) => `<li>${interestMap[i]}</li>`)
    .join('');

  const content = `
    <p style="font-size: 1.1em;">Hi ${fullName || 'there'},</p>
    <p>Thank you for joining the <strong>${EMAIL_CONSTANT.appName}</strong> waitlist!</p>
    <p>We're thrilled about your interest in:</p>
    <ul style="padding-left: 20px; font-size: 1em;">${interestItems}</ul>
    <p>We'll be in touch soon with updates tailored to your interest(s).</p>
    <p>Welcome aboard! 🎉</p>
  `;

  return baseTemplate({
    title: "You're on the Waitlist!",
    content,
  });
}
