# Alternative Email Service Setup Guide

If you're experiencing persistent issues with Truehost SMTP, here are alternatives you can quickly set up:

## 1. SendGrid (Recommended)

1. **Sign up for a free account**: https://signup.sendgrid.com/

2. **Create an API Key**:
   - Navigate to Settings > API Keys
   - Create a new API Key with "Mail Send" permissions
   - Copy the API key

3. **Update your .env file**:
```
# SendGrid Configuration
SMTP_SERVICE="sendgrid"
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey" # This must be literally "apikey"
SMTP_PASSWORD="YOUR_SENDGRID_API_KEY"
SMTP_FROM='"Propellant HR" <hr@propellanthr.com>'
```

4. **Update mail.module.ts**:
```typescript
transport: {
  service: ENVIRONMENT.SMTP.SERVICE,
  host: ENVIRONMENT.SMTP.HOST,
  port: 587,
  secure: false,
  auth: {
    user: ENVIRONMENT.SMTP.USER, // Should be 'apikey'
    pass: ENVIRONMENT.SMTP.PASSWORD, // Your SendGrid API key
  },
}
```

## 2. Mailgun

1. **Sign up for a free account**: https://signup.mailgun.com/new/signup

2. **Add your domain** or use Mailgun's sandbox domain for testing

3. **Get SMTP credentials**:
   - Go to Sending > Domain settings > SMTP credentials
   - Note your SMTP hostname, username, and password

4. **Update your .env file**:
```
# Mailgun Configuration
SMTP_SERVICE="mailgun"
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT=587
SMTP_USER="your-mailgun-smtp-username"
SMTP_PASSWORD="your-mailgun-smtp-password"
SMTP_FROM='"Propellant HR" <hr@propellanthr.com>'
```

## 3. Gmail (For Testing)

1. **Enable 2-Step Verification** on your Google account

2. **Create an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Generate and copy the 16-character password

3. **Update your .env file**:
```
# Gmail Configuration
SMTP_SERVICE="gmail"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-gmail@gmail.com"
SMTP_PASSWORD="your-16-char-app-password"
SMTP_FROM='"Propellant HR" <your-gmail@gmail.com>'
```

## Implementation

1. Update your `.env` file with one of the configurations above
2. Update `environment.ts` to include the new SERVICE property
3. Modify `mail.module.ts` to use the appropriate settings for your chosen provider

## Testing

Use the test endpoint: `/api/v1/mail/test?email=your-email@example.com`
