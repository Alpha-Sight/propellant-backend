import { PremiumEmailTemplateProps } from 'src/common/interfaces/email-templates.interface';

export const premiumPlanNotificationEmailTemplate = ({
  user,
  reference,
  upgradeDate,
  totalAmount,
  currencySymbol = '₦',
}: PremiumEmailTemplateProps): string => {
  return `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2d9cdb;">Premium Plan Activated!</h2>
  
        <p>Dear ${user.join(' ')},</p>
  
        <p>We're excited to inform you that your premium subscription has been successfully activated.</p>
  
        <h4>🧾 Transaction Details:</h4>
        <ul>
          <li><strong>Reference ID:</strong> ${reference}</li>
          <li><strong>Upgrade Date:</strong> ${upgradeDate}</li>
          <li><strong>Amount Paid:</strong> ${currencySymbol}${totalAmount.toLocaleString()}</li>
        </ul>
  
        <p>You now have access to exclusive premium features and tools to elevate your experience.</p>
  
        <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
  
        <p style="margin-top: 30px;">Cheers,</p>
        <p><strong>The GreenBounty Team</strong></p>
  
        <hr style="margin-top: 40px;"/>
        <p style="font-size: 12px; color: #888;">
          This is an automated message. Please do not reply to this email directly.
        </p>
      </div>
    `;
};
