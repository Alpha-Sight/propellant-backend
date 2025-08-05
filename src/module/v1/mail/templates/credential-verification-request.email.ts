import { ENVIRONMENT } from 'src/common/configs/environment';

export function CredentialVerificationRequestTemplate(data: {
  verifyingOrganization: string;
  verifyingEmail: string;
  issuingOrganization?: string;
  credentialTitle: string;
  userName: string;
  message?: string;
  issueDate?: string;
  expiryDate?: string;
  url?: string;
}) {
  const appUrl = ENVIRONMENT.FRONTEND.URL;
  const loginUrl = `${appUrl}/auth/login`;
  const signupUrl = `${appUrl}/auth/signup`;
  const logoUrl = `${appUrl}/assets/logo.png`; // Update this path to your actual logo URL
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credential Verification Request</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
            }
            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 10px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 30px;
                text-align: center;
                color: white;
            }
            .logo {
                max-width: 120px;
                margin-bottom: 20px;
                height: auto;
            }
            .header h1 {
                font-size: 28px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            .header p {
                font-size: 16px;
                opacity: 0.9;
            }
            .content {
                padding: 40px 30px;
            }
            .greeting {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 25px;
            }
            .intro {
                font-size: 16px;
                color: #555;
                margin-bottom: 30px;
                line-height: 1.7;
            }
            .credential-details {
                background-color: #f8f9fa;
                border-left: 4px solid #667eea;
                padding: 25px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
            }
            .credential-details h3 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 18px;
            }
            .detail-item {
                display: flex;
                margin-bottom: 12px;
                padding: 8px 0;
                border-bottom: 1px solid #e9ecef;
            }
            .detail-item:last-child {
                border-bottom: none;
            }
            .detail-label {
                font-weight: 600;
                color: #495057;
                min-width: 130px;
                margin-right: 15px;
            }
            .detail-value {
                color: #212529;
                flex: 1;
            }
            .message-section {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 20px;
                margin: 25px 0;
            }
            .message-section h4 {
                color: #856404;
                margin-bottom: 10px;
            }
            .message-content {
                color: #856404;
                font-style: italic;
                line-height: 1.6;
            }
            .action-section {
                text-align: center;
                margin: 35px 0;
                padding: 25px;
                background-color: #f8f9fa;
                border-radius: 8px;
            }
            .action-text {
                font-size: 16px;
                color: #495057;
                margin-bottom: 25px;
            }
            .button-group {
                display: inline-block;
                margin: 0 auto;
            }
            .btn {
                display: inline-block;
                padding: 14px 28px;
                margin: 0 10px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                transition: all 0.3s ease;
            }
            .btn-primary {
                background-color: #667eea;
                color: white;
                border: 2px solid #667eea;
            }
            .btn-secondary {
                background-color: transparent;
                color: #667eea;
                border: 2px solid #667eea;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            .footer {
                background-color: #2c3e50;
                color: #ecf0f1;
                padding: 30px;
                text-align: center;
            }
            .footer-content {
                margin-bottom: 20px;
            }
            .footer-links {
                margin: 20px 0;
            }
            .footer-links a {
                color: #3498db;
                text-decoration: none;
                margin: 0 15px;
            }
            .footer-links a:hover {
                text-decoration: underline;
            }
            .footer-note {
                font-size: 12px;
                color: #95a5a6;
                margin-top: 20px;
                line-height: 1.5;
            }
            @media (max-width: 600px) {
                .email-container {
                    margin: 10px;
                    border-radius: 0;
                }
                .header, .content {
                    padding: 25px 20px;
                }
                .btn {
                    display: block;
                    margin: 10px 0;
                    text-align: center;
                }
                .button-group {
                    display: block;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <!-- Header Section -->
            <div class="header">
                <img src="${logoUrl}" alt="Propellant Logo" class="logo" />
                <h1>Credential Verification Request</h1>
                <p>Professional Credential Verification Platform</p>
            </div>

            <!-- Content Section -->
            <div class="content">
                <div class="greeting">
                    Dear ${data.verifyingOrganization} Team,
                </div>

                <div class="intro">
                    We hope this message finds you well. We are reaching out to request your assistance in verifying a professional credential that has been submitted through our platform. Your verification will help maintain the integrity and trustworthiness of professional credentials in our ecosystem.
                </div>

                <!-- Credential Details -->
                <div class="credential-details">
                    <h3>📋 Credential Information</h3>
                    <div class="detail-item">
                        <div class="detail-label">Credential Title:</div>
                        <div class="detail-value"><strong>${data.credentialTitle}</strong></div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Submitted By:</div>
                        <div class="detail-value">${data.userName}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Issuing Organization:</div>
                        <div class="detail-value">${data.issuingOrganization || 'Not specified'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Issue Date:</div>
                        <div class="detail-value">${data.issueDate || 'Not specified'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Expiry Date:</div>
                        <div class="detail-value">${data.expiryDate || 'Not specified'}</div>
                    </div>
                    ${data.url ? `
                    <div class="detail-item">
                        <div class="detail-label">Reference URL:</div>
                        <div class="detail-value"><a href="${data.url}" target="_blank" style="color: #667eea; text-decoration: none;">${data.url}</a></div>
                    </div>
                    ` : ''}
                </div>

                ${data.message ? `
                <!-- Message Section -->
                <div class="message-section">
                    <h4>💬 Message from Credential Holder</h4>
                    <div class="message-content">"${data.message}"</div>
                </div>
                ` : ''}

                <!-- Action Section -->
                <div class="action-section">
                    <div class="action-text">
                        To complete the verification process, please log in to our platform or create an account if you don't have one yet.
                    </div>
                    <div class="button-group">
                        <a href="${loginUrl}" class="btn btn-primary">Login to Verify</a>
                        <a href="${signupUrl}" class="btn btn-secondary">Create Account</a>
                    </div>
                </div>

                <div style="margin-top: 30px; padding: 20px; background-color: #e8f5e8; border-radius: 8px; border-left: 4px solid #28a745;">
                    <p style="margin: 0; color: #155724; font-size: 14px;">
                        <strong>🔒 Security Note:</strong> This verification request is legitimate and comes from our secure platform. Your participation helps maintain professional credential integrity across industries.
                    </p>
                </div>
            </div>

            <!-- Footer Section -->
            <div class="footer">
                <div class="footer-content">
                    <strong>Propellant</strong><br>
                    Professional Credential Verification Platform
                </div>
                
                <div class="footer-links">
                    <a href="${appUrl}">Visit Platform</a>
                    <a href="${appUrl}/about">About Us</a>
                    <a href="${appUrl}/contact">Contact Support</a>
                    <a href="${appUrl}/privacy">Privacy Policy</a>
                </div>

                <div class="footer-note">
                    This email was sent to ${data.verifyingEmail} regarding a credential verification request. 
                    If you believe this email was sent to you in error, please contact our support team.<br><br>
                    
                    © ${new Date().getFullYear()} Propellant. All rights reserved.<br>
                    Professional Credential Verification Platform
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}
