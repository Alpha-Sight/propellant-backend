# Truehost SMTP Troubleshooting Guide

## Problem

Experiencing SSL/TLS connection errors when trying to connect to Truehost SMTP server:

```
[Nest] 69842  - 06/17/2025, 4:35:19 PM   ERROR [ExceptionsHandler] 00B6BE0901000000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number:../deps/openssl/openssl/ssl/record/ssl3_record.c:355
```

## Troubleshooting Steps

### 1. Confirm SMTP Server Details with Truehost Support

Contact Truehost support to confirm:

- Correct SMTP hostname
- Required SSL/TLS settings
- Any specific authentication requirements
- Recommended port (465 vs 587)

### 2. Try These Different Configuration Options

**Option 1: Use Port 465 with SSL**

```
SMTP_HOST="workplace.truehost.cloud"
SMTP_PORT=465
SMTP_EMAIL="hr@propellanthr.com"
SMTP_USER="hr@propellanthr.com"
SMTP_PASSWORD="4_JPw@+kT2L"
```

Mail module configuration:

```typescript
transport: {
  host: ENVIRONMENT.SMTP.HOST,
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: ENVIRONMENT.SMTP.USER,
    pass: ENVIRONMENT.SMTP.PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
}
```

**Option 2: Use Port 587 with STARTTLS**

```
SMTP_HOST="workplace.truehost.cloud"
SMTP_PORT=587
SMTP_EMAIL="hr@propellanthr.com"
SMTP_USER="hr@propellanthr.com"
SMTP_PASSWORD="4_JPw@+kT2L"
```

Mail module configuration:

```typescript
transport: {
  host: ENVIRONMENT.SMTP.HOST,
  port: 587,
  secure: false, // For STARTTLS
  auth: {
    user: ENVIRONMENT.SMTP.USER,
    pass: ENVIRONMENT.SMTP.PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
}
```

**Option 3: Use IP Address Directly**

```
SMTP_HOST="102.212.247.98"
SMTP_PORT=465
SMTP_EMAIL="hr@propellanthr.com"
SMTP_USER="hr@propellanthr.com"
SMTP_PASSWORD="4_JPw@+kT2L"
```

**Option 4: Try Direct Connection String**

```typescript
transport: 'smtps://hr%40propellanthr.com:4_JPw%40%2bkT2L@102.212.247.98:465',
```

### 3. Test with Older TLS Versions

Some older email servers require legacy SSL/TLS versions:

```typescript
transport: {
  host: ENVIRONMENT.SMTP.HOST,
  port: parseInt(ENVIRONMENT.SMTP.PORT as string),
  secure: ENVIRONMENT.SMTP.PORT === '465',
  auth: {
    user: ENVIRONMENT.SMTP.USER,
    pass: ENVIRONMENT.SMTP.PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3',
    secureProtocol: 'TLSv1_method',
  },
}
```

### 4. Alternative: Use a Different Email Service

If Truehost continues to cause problems, consider these alternatives:

1. **SendGrid**

   - Free tier: 100 emails/day
   - Easy to integrate with NestJS
   - Excellent deliverability

2. **Mailgun**

   - Free tier: 5,000 emails/month for 3 months
   - Good for transactional emails

3. **Amazon SES**
   - Very low cost ($0.10 per 1000 emails)
   - High deliverability
   - AWS integration

## Testing Your Connection

Use this command to test direct connection to the SMTP server:

```
nc -zv workplace.truehost.cloud 465
```

Or for the IP address:

```
nc -zv 102.212.247.98 465
```
