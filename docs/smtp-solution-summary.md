# SMTP Configuration Solution for Truehost

## Problem Summary

We were experiencing an SSL/TLS connection error when trying to use port 465 with Truehost SMTP server:

```
ERROR [ExceptionsHandler] 00B6BE0901000000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number
```

## Root Cause

The error was caused by a mismatch between our SSL/TLS configuration and what the Truehost SMTP server was expecting.
Our diagnosis found that:

1. Port 465 with SSL/TLS was consistently failing with a "wrong version number" error
2. Port 587 with STARTTLS protocol worked perfectly

## Diagnostic Process

We created a detailed diagnostic script that tested multiple SMTP configurations against the Truehost server. This script:

1. Tested direct TLS connections with different protocol versions
2. Tried multiple port and security combinations
3. Identified the exact working configuration

The diagnostic script confirmed that while port 465 always failed, port 587 with STARTTLS worked reliably.

## Solution

### Environment Configuration (.env file)

```properties
SMTP_HOST="workplace.truehost.cloud"
SMTP_PORT=587
SMTP_EMAIL="hr@propellanthr.com"
SMTP_USER="hr@propellanthr.com"
SMTP_PASSWORD="4_JPw@+kT2L"
SMTP_FROM='"Propellant HR" <hr@propellanthr.com>'
```

### Mail Module Configuration (mail.module.ts)

```typescript
transport: {
  host: ENVIRONMENT.SMTP.HOST,
  port: 587,
  secure: false, // false for STARTTLS
  auth: {
    user: ENVIRONMENT.SMTP.USER,
    pass: ENVIRONMENT.SMTP.PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  }
}
```

## Key Learnings

1. **Port selection matters**:

   - Port 465: Traditionally uses implicit SSL/TLS (secure: true)
   - Port 587: Uses STARTTLS (secure: false)

2. **SSL/TLS protocol version compatibility**:

   - Some SMTP servers may require specific protocol versions
   - Truehost seems to prefer STARTTLS on port 587 rather than SSL/TLS on port 465

3. **Diagnostic approach**:
   - Testing direct TCP connections helped isolate the issue
   - Trying multiple configurations systematically identified the solution
   - Using a specialized diagnostic script was more effective than trial and error

## Recommendations for Future

1. Always test SMTP configurations with a diagnostic script before deploying
2. For Truehost specifically, use port 587 with STARTTLS
3. Include proper error handling for email sending throughout the application

## Documentation

Additional documentation has been added to the project:

- `/docs/fixing-ssl-version-error.md` - General guide for SSL connection issues
- `/docs/truehost-smtp-troubleshooting.md` - Specific Truehost SMTP guidance
- `/docs/alternative-email-providers.md` - Options for other email providers
- `/src/scripts/detailed-smtp-test.js` - Diagnostic script for SMTP issues
