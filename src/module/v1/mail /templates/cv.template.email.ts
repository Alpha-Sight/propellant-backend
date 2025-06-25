export const cvGeneratedEmailTemplate = (context: {
  firstName: string;
  lastName: string;
  appName: string;
  hasWorkExperience: boolean;
  hasSkills: boolean;
  hasCertifications: boolean;
  hasLanguages: boolean;
  hasBio: boolean;
  generatedDate: string;
}) => {
  return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your CV is Ready</title>
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
                  background-color: #f8f9fa;
                  padding: 20px;
              }
              
              .email-container {
                  max-width: 600px;
                  margin: 0 auto;
                  background-color: #ffffff;
                  border-radius: 12px;
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                  overflow: hidden;
              }
              
              .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 40px 30px;
                  text-align: center;
                  position: relative;
              }
              
              .header::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                  pointer-events: none;
              }
              
              .header h1 {
                  font-size: 32px;
                  font-weight: 700;
                  margin-bottom: 10px;
                  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                  position: relative;
                  z-index: 1;
              }
              
              .header p {
                  font-size: 18px;
                  opacity: 0.9;
                  position: relative;
                  z-index: 1;
              }
              
              .content {
                  padding: 40px 30px;
              }
              
              .greeting {
                  font-size: 18px;
                  margin-bottom: 25px;
                  color: #2c3e50;
              }
              
              .greeting strong {
                  color: #667eea;
                  font-weight: 600;
              }
              
              .main-message {
                  font-size: 16px;
                  margin-bottom: 30px;
                  color: #555;
                  line-height: 1.7;
              }
              
              .features-section {
                  background: linear-gradient(135deg, #f8f9ff 0%, #e8f4fd 100%);
                  padding: 30px;
                  border-radius: 12px;
                  margin: 30px 0;
                  border-left: 5px solid #667eea;
                  position: relative;
              }
              
              .features-section::before {
                  content: '📋';
                  position: absolute;
                  top: -10px;
                  left: 20px;
                  background: #667eea;
                  color: white;
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 18px;
              }
              
              .features-title {
                  font-size: 20px;
                  font-weight: 600;
                  color: #667eea;
                  margin-bottom: 20px;
                  margin-top: 10px;
              }
              
              .features-list {
                  list-style: none;
                  padding: 0;
              }
              
              .features-list li {
                  padding: 12px 0;
                  border-bottom: 1px solid rgba(102, 126, 234, 0.1);
                  font-size: 15px;
                  color: #444;
                  display: flex;
                  align-items: center;
                  transition: all 0.3s ease;
              }
              
              .features-list li:last-child {
                  border-bottom: none;
              }
              
              .features-list li::before {
                  content: "✅";
                  margin-right: 12px;
                  font-size: 16px;
                  flex-shrink: 0;
              }
              
              .features-list li:hover {
                  background-color: rgba(102, 126, 234, 0.05);
                  padding-left: 10px;
                  border-radius: 6px;
              }
              
              .attachment-section {
                  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                  padding: 25px;
                  border-radius: 12px;
                  text-align: center;
                  margin: 30px 0;
                  border: 2px dashed #ff9800;
                  position: relative;
              }
              
              .attachment-icon {
                  font-size: 48px;
                  margin-bottom: 15px;
                  display: block;
                  animation: bounce 2s infinite;
              }
              
              @keyframes bounce {
                  0%, 20%, 50%, 80%, 100% {
                      transform: translateY(0);
                  }
                  40% {
                      transform: translateY(-10px);
                  }
                  60% {
                      transform: translateY(-5px);
                  }
              }
              
              .attachment-title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #e65100;
                  margin-bottom: 10px;
              }
              
              .attachment-subtitle {
                  color: #bf360c;
                  font-size: 14px;
                  font-style: italic;
              }
              
              .usage-section {
                  margin: 30px 0;
              }
              
              .usage-title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #2c3e50;
                  margin-bottom: 15px;
              }
              
              .usage-list {
                  list-style: none;
                  padding: 0;
              }
              
              .usage-list li {
                  padding: 8px 0;
                  font-size: 15px;
                  color: #555;
                  display: flex;
                  align-items: center;
              }
              
              .usage-list li::before {
                  margin-right: 10px;
                  font-size: 16px;
                  flex-shrink: 0;
              }
              
              .usage-list li:nth-child(1)::before { content: "🎯"; }
              .usage-list li:nth-child(2)::before { content: "🤝"; }
              .usage-list li:nth-child(3)::before { content: "💼"; }
              .usage-list li:nth-child(4)::before { content: "📧"; }
              
              .tip-section {
                  background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
                  border-left: 4px solid #ffc107;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 30px 0;
                  position: relative;
              }
              
              .tip-section::before {
                  content: "💡";
                  position: absolute;
                  top: -8px;
                  left: 15px;
                  background: #ffc107;
                  width: 30px;
                  height: 30px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 14px;
              }
              
              .tip-title {
                  font-weight: 600;
                  color: #f57f17;
                  margin-bottom: 8px;
                  margin-top: 5px;
              }
              
              .tip-content {
                  color: #e65100;
                  font-size: 14px;
                  line-height: 1.6;
              }
              
              .closing-message {
                  text-align: center;
                  font-size: 16px;
                  font-style: italic;
                  color: #667eea;
                  background: linear-gradient(135deg, #f8f9ff 0%, #e8f4fd 100%);
                  padding: 25px;
                  border-radius: 12px;
                  margin: 30px 0;
                  border: 1px solid rgba(102, 126, 234, 0.2);
              }
              
              .footer {
                  background: linear-gradient(135deg, #37474f 0%, #263238 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
              }
              
              .footer-greeting {
                  font-size: 16px;
                  margin-bottom: 10px;
                  opacity: 0.9;
              }
              
              .team-name {
                  font-size: 22px;
                  font-weight: 700;
                  color:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  margin-bottom: 20px;
                  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
              }
              
              .disclaimer {
                  border-top: 1px solid rgba(255, 255, 255, 0.2);
                  padding-top: 20px;
                  margin-top: 20px;
              }
              
              .disclaimer p {
                  font-size: 12px;
                  opacity: 0.7;
                  margin: 5px 0;
                  line-height: 1.4;
              }
              
              .divider {
                  height: 3px;
                  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                  border: none;
                  margin: 30px 0;
                  border-radius: 2px;
              }
              
              @media only screen and (max-width: 600px) {
                  body {
                      padding: 10px;
                  }
                  
                  .header {
                      padding: 30px 20px;
                  }
                  
                  .header h1 {
                      font-size: 28px;
                  }
                  
                  .content {
                      padding: 30px 20px;
                  }
                  
                  .features-section,
                  .attachment-section {
                      padding: 20px;
                  }
                  
                  .footer {
                      padding: 25px 20px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-container">
              <div class="header">
                  <h1> Your CV is Ready!</h1>
                  <p>Professional CV Generated Successfully</p>
              </div>
  
              <div class="content">
                  <div class="greeting">
                      Dear <strong>${context.firstName} ${context.lastName}</strong>,
                  </div>
                  
                  <div class="main-message">
                      Congratulations! We've successfully generated your professional CV based on your complete profile information. Your career document is now ready to help you make a stellar first impression!
                  </div>
                  
                  <div class="features-section">
                      <div class="features-title">Your CV Includes:</div>
                      <ul class="features-list">
                          <li>Personal Information & Contact Details</li>
                          <li>Education Background & Academic Achievements</li>
                          ${context.hasWorkExperience ? '<li>Professional Work Experience & Career History</li>' : ''}
                          ${context.hasSkills ? '<li>Skills & Technical Competencies</li>' : ''}
                          ${context.hasCertifications ? '<li>Certifications & Professional Achievements</li>' : ''}
                          ${context.hasLanguages ? '<li>Language Proficiencies & Communication Skills</li>' : ''}
                          ${context.hasBio ? '<li>Professional Summary & Career Objective</li>' : ''}
                      </ul>
                  </div>
  
                  <div class="attachment-section">
                      <span class="attachment-icon">📎</span>
                      <div class="attachment-title">Your CV is attached to this email as a PDF file</div>
                      <div class="attachment-subtitle">File name: ${context.firstName}_${context.lastName}_CV.pdf</div>
                  </div>
                  
                  <hr class="divider">
                  
                  <div class="usage-title">Perfect for:</div>
                  <ul class="usage-list">
                      <li>Job applications and career opportunities</li>
                      <li>Professional networking and connections</li>
                      <li>LinkedIn profile enhancement</li>
                      <li>Email signatures and professional correspondence</li>
                  </ul>
                  
                  <div class="tip-section">
                      <div class="tip-title">Pro Tip:</div>
                      <div class="tip-content">
                          Keep your profile updated! You can generate a new CV anytime by updating your profile information and requesting a fresh copy. Your success is our priority!
                      </div>
                  </div>
  
                  <div class="closing-message">
                      Ready to take the next step in your career? Your professional CV is now ready to open doors and create opportunities!
                  </div>
              </div>
  
              <div class="footer">
                  <div class="footer-greeting">Best regards,</div>
                  <div class="team-name">The ${context.appName} Team</div>
                  
                  <div class="disclaimer">
                      <p>This email was sent automatically from ${context.appName}.</p>
                      <p>Generated on ${context.generatedDate} | Please do not reply to this email.</p>
                      <p>© ${new Date().getFullYear()} ${context.appName}. All rights reserved.</p>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `;
};

export const cvGeneratedEmailSubject = (
  firstName: string,
  //   lastName: string,
) => {
  return `🎉 Your Professional CV is Ready, ${firstName}!`;
};
