import { baseTemplate } from './base-template.mail';
import { EMAIL_CONSTANT } from '../../../../common/constants/email.constant';
import { WaitlistInterestEnum } from 'src/common/enums/waitlist.enum';
import { IWaitlistEmailTemplate } from 'src/common/interfaces/email-templates.interface';

export function waitlistConfirmationEmailTemplate(
  data: IWaitlistEmailTemplate,
) {
  const { interest } = data;

  // Handle single interest (backward compatibility)
  if (typeof interest === 'string') {
    return getSingleInterestTemplate(interest as WaitlistInterestEnum, data);
  }

  // Handle multiple interests
  if (Array.isArray(interest)) {
    const interests = interest as WaitlistInterestEnum[];
    if (interests.length > 0) {
      return interests.map((singleInterest) =>
        getSingleInterestTemplate(singleInterest, data),
      );
    }
  }

  // Fallback
  return getSingleInterestTemplate(interest as WaitlistInterestEnum, data);
}
function getSingleInterestTemplate(
  interest: WaitlistInterestEnum,
  data: IWaitlistEmailTemplate,
) {
  if (interest === WaitlistInterestEnum.TALENT) {
    return TalentWaitlistConfirmationEmailTemplate(data);
  } else if (interest === WaitlistInterestEnum.ORGANIZATION) {
    return OrganizationWaitlistConfirmationEmailTemplate(data);
  } else if (interest === WaitlistInterestEnum.INVEST) {
    return investorWaitlistConfirmationEmailTemplate(data);
  } else if (interest === WaitlistInterestEnum.VOLUNTEER) {
    return volunteersWaitlistConfirmationEmailTemplate(data);
  }
}

export function OrganizationWaitlistConfirmationEmailTemplate(
  data: IWaitlistEmailTemplate,
) {
  const appName = EMAIL_CONSTANT.appName;
  const { fullName } = data;
  const content = `
  <table align="center" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" class="content">
      <p style="font-size: 16px; color: #202020; font-weight: 700">
        Hello ${fullName}
      </p>
      <p style="font-size: 16px; color: #646464">
        Thank you for joining ${appName}'s waitlist! We’re excited to have you
        onboard as we prepare to launch an unparalleled platform for discovering
        high-quality products from trusted sellers.
      </p>
      <p style="font-size: 16px; color: #646464">
        As a ${appName} Buyer, you’ll soon have access to:
      </p>
      <ul style="font-size: 16px; color: #646464">
        <li>
          Exclusive Product Listings: Browse an expansive catalog of items
          suited to every need and budget.
        </li>
        <li>
          Verified Seller Network: Shop with confidence knowing every seller has
          been vetted for quality and reliability.
        </li>
        <li>
          Special Buyer Benefits: Look out for early-bird discounts and
          member-only deals.
        </li>
      </ul>
      <p style="font-size: 16px; color: #646464">
        Stay tuned as we bring you updates on our launch and exclusive insights
        straight to your inbox!
      </p>
    </td>
    </tr>
  </table>`;

  return baseTemplate({
    title: `Welcome to ${appName} Waitlist`,
    content,
  });
}

export function TalentWaitlistConfirmationEmailTemplate(
  data: IWaitlistEmailTemplate,
) {
  const appName = EMAIL_CONSTANT.appName;
  const { fullName } = data;
  const content = `
  <table align="center" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" class="content">
      <p style="font-size: 16px; color: #202020; font-weight: 700">
        Hello ${fullName}
      </p>
      <p style="font-size: 16px; color: #646464">
        Thank you for joining ${appName}'s seller waitlist! We're thrilled to have you
        as a potential seller on our platform where you'll be able to reach countless
        eager buyers.
      </p>
      <p style="font-size: 16px; color: #646464">
        As a ${appName} Seller, you'll soon have access to:
      </p>
      <ul style="font-size: 16px; color: #646464">
        <li>
          Powerful Seller Dashboard: Manage your inventory, track sales, and analyze
          performance all in one place.
        </li>
        <li>
          Wide Customer Reach: Connect with verified buyers actively looking for
          quality products.
        </li>
        <li>
          Secure Payments: Benefit from our reliable payment processing system and
          seller protection policies.
        </li>
        <li>
          Marketing Tools: Access built-in promotional features to boost your
          sales and visibility.
        </li>
      </ul>
      <p style="font-size: 16px; color: #646464">
        We'll keep you updated on our launch timeline and share exclusive seller
        resources to help you prepare for success on ${appName}!
      </p>
    </td>
    </tr>
  </table>`;

  return baseTemplate({
    title: `Welcome to ${appName} Seller Waitlist`,
    content,
  });
}

export function investorWaitlistConfirmationEmailTemplate(
  data: IWaitlistEmailTemplate,
) {
  const appName = EMAIL_CONSTANT.appName;
  const { fullName } = data;
  const content = `
  <table align="center" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" class="content">
      <p style="font-size: 16px; color: #202020; font-weight: 700">
        Hello ${fullName}
      </p>
      <p style="font-size: 16px; color: #646464">
        Thank you for joining ${appName}'s investor waitlist! We're excited to have you
        onboard as we prepare to launch an unparalleled platform for discovering
        high-quality products from trusted sellers.
      </p>
      <p style="font-size: 16px; color: #646464">
        As a ${appName} Investor, you'll soon have access to:
      </p>
      <ul style="font-size: 16px; color: #646464">
        <li>
          Exclusive Product Listings: Browse an expansive catalog of items
          suited to every need and budget.
        </li>
        <li>
          Verified Seller Network: Invest with confidence knowing every seller has
          been vetted for quality and reliability.
        </li>
        <li>
          Special Investor Benefits: Look out for early-bird discounts and
          member-only deals.
        </li>
      </ul>
      <p style="font-size: 16px; color: #646464">
        Stay tuned as we bring you updates on our launch and exclusive insights
        straight to your inbox!
      </p>
    </td>
    </tr>
  </table>`;

  return baseTemplate({
    title: `Welcome to ${appName} Investor Waitlist`,
    content,
  });
}

export function volunteersWaitlistConfirmationEmailTemplate(
  data: IWaitlistEmailTemplate,
) {
  const appName = EMAIL_CONSTANT.appName;
  const { fullName } = data;
  const content = `
  <table align="center" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="left" class="content">
      <p style="font-size: 16px; color: #202020; font-weight: 700">
        Hello ${fullName}
      </p>
      <p style="font-size: 16px; color: #646464">
        Thank you for joining ${appName}'s seller waitlist! We're thrilled to have you
        as a potential seller on our platform where you'll be able to reach countless
        eager buyers.
      </p>
      <p style="font-size: 16px; color: #646464">
        As a ${appName} Seller, you'll soon have access to:
      </p>
      <ul style="font-size: 16px; color: #646464">
        <li>
          Powerful Seller Dashboard: Manage your inventory, track sales, and analyze
          performance all in one place.
        </li>
        <li>
          Wide Customer Reach: Connect with verified buyers actively looking for
          quality products.
        </li>
        <li>
          Secure Payments: Benefit from our reliable payment processing system and
          seller protection policies.
        </li>
        <li>
          Marketing Tools: Access built-in promotional features to boost your
          sales and visibility.
        </li>
      </ul>
      <p style="font-size: 16px; color: #646464">
        We'll keep you updated on our launch timeline and share exclusive seller
        resources to help you prepare for success on ${appName}!
      </p>
    </td>
    </tr>
  </table>`;

  return baseTemplate({
    title: `Welcome to ${appName} Seller Waitlist`,
    content,
  });
}
