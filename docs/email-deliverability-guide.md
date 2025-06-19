# Email Deliverability Guide for Propellant HR

## Overview

This guide provides instructions for setting up proper email authentication to improve deliverability and prevent emails from landing in spam folders.

## DNS Records Setup

### 1. SPF (Sender Policy Framework) Record

SPF records specify which mail servers are allowed to send emails from your domain. Add this TXT record to your DNS configuration:

```
Name: propellanthr.com
Type: TXT
Value: v=spf1 include:truehost.cloud include:_spf.google.com ip4:102.212.247.98 ~all
```

### 2. DKIM (DomainKeys Identified Mail) Record

DKIM adds a digital signature to your emails that verifies they haven't been altered in transit. Request the DKIM keys from Truehost support, then add them to your DNS:

```
Name: truehost._domainkey.propellanthr.com
Type: TXT
Value: (Get this from Truehost - it will be a long string beginning with "v=DKIM1; k=rsa; p=...")
```

### 3. DMARC (Domain-based Message Authentication, Reporting & Conformance) Record

DMARC tells email providers what to do with emails that fail authentication checks:

```
Name: _dmarc.propellanthr.com
Type: TXT
Value: v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@propellanthr.com
```

## Email Content Best Practices

1. **Avoid spam trigger words** like "Important", "Urgent", "Free", "Act now", "Limited time", etc.
2. **Maintain a balanced text-to-image ratio** (60% text, 40% images)
3. **Use proper HTML formatting** with tables instead of divs for better compatibility
4. **Include an unsubscribe link** in all marketing communications
5. **Personalize emails** whenever possible
6. **Ensure your emails are mobile-responsive**

## Technical Settings

1. **Set up reverse DNS (PTR records)** for your sending IP address
2. **Warm up your email sending** gradually for new IP addresses
3. **Monitor your sending reputation** using tools like mail-tester.com
4. **Regularly check blacklist status** of your sending domain/IP

## Testing Your Email Deliverability

1. Use [mail-tester.com](https://www.mail-tester.com) to test your email's spam score
2. Use the test endpoint in the Propellant API: `/api/v1/mail/test?email=test@example.com`
