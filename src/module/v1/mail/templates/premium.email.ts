import { PremiumEmailTemplateProps } from 'src/common/interfaces/email-templates.interface';

export const premiumPlanNotificationEmailTemplate = ({
  user,
  reference,
  upgradeDate,
  totalAmount,
  plan,
  currencySymbol = '₦',
}: PremiumEmailTemplateProps): string => {
  return `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 40px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">

      <!-- HEADER -->
      <div style="background-color: #001f3f; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: bold;">
          ${plan} PLAN ACTIVATED!
        </h1>
      </div>

      <!-- BODY -->
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #444;">Dear ${user.join(' ')},</p>

        <p style="font-size: 15px; line-height: 1.6; color: #555;">
          We're excited to inform you that your premium subscription has been successfully activated.
        </p>

        <h4 style="color: #001f3f; margin-top: 25px; font-size: 18px;">🧾 Transaction Details:</h4>
        <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Reference ID:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${reference}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Upgrade Date:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${upgradeDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Upgrade Plan:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${plan}</td>
          </tr>
          <tr>
            <td style="padding: 8px;"><strong>Amount Paid:</strong></td>
            <td style="padding: 8px;">${currencySymbol}${totalAmount.toLocaleString()}</td>
          </tr>
        </table>

        <p style="font-size: 15px; line-height: 1.6; color: #555; margin-top: 20px;">
          You now have access to exclusive premium features and tools to elevate your experience.
        </p>

        <p style="font-size: 15px; line-height: 1.6; color: #555;">
          If you have any questions, feel free to reply to this email or contact our support team.
        </p>

        <p style="margin-top: 30px; font-size: 15px; color: #444;">Cheers,</p>
        <p style="font-weight: bold; color: #001f3f;">PropellantHR Team</p>
      </div>

      <!-- FOOTER -->
      <div style="background-color: #001f3f; padding: 15px; text-align: center;">
        <p style="font-size: 12px; color: #bbb; margin: 0;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </div>

    </div>
  </div>
  `;
};
