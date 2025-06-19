# Fixing "Wrong Version Number" SSL Error in Node.js SMTP

## Error Description

```
ERROR [ExceptionsHandler] 00B6BE0901000000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number:../deps/openssl/openssl/ssl/record/ssl3_record.c:355:
```

This error occurs when there's a mismatch between the SSL/TLS protocol versions supported by the client (your Node.js application) and the server (SMTP server).

## Common Causes

1. **Port mismatch**: Using SSL/TLS on a non-SSL port, or vice versa
2. **Protocol version mismatch**: Server requires an older TLS version
3. **Server configuration**: The SMTP server may have unusual SSL/TLS settings
4. **Connection interference**: Firewall or proxy is interfering with SSL/TLS handshake

## Solutions

### Solution 1: Verify Port and Security Settings

- For port 465: Use `secure: true` (SSL/TLS)
- For port 587: Use `secure: false` (STARTTLS)

```typescript
transport: {
  host: 'smtp.example.com',
  port: 587,
  secure: false, // false for 587, true for 465
  // ...
}
```

### Solution 2: Explicitly Set TLS Version

```typescript
transport: {
  host: 'smtp.example.com',
  port: 465,
  secure: true,
  tls: {
    minVersion: 'TLSv1', // Try with older TLS version
    rejectUnauthorized: false
  }
}
```

### Solution 3: Try Direct Connection String

```typescript
transport: 'smtps://user%40example.com:password@smtp.example.com:465';
```

### Solution 4: Try a Well-Known Email Service

Use a service like Gmail, SendGrid, or Mailgun which have standardized configurations:

```typescript
transport: {
  service: 'gmail', // Uses predefined settings for Gmail
  auth: {
    user: 'your-gmail@gmail.com',
    pass: 'your-app-password'
  }
}
```

### Solution 5: Use IP Address Instead of Hostname

DNS resolution issues can sometimes cause SSL problems. Try using the IP address directly:

```typescript
transport: {
  host: '123.456.789.101', // IP address instead of hostname
  port: 465,
  secure: true,
  // ...
}
```

### Solution 6: Disable SSL Verification (Not recommended for production)

```typescript
transport: {
  host: 'smtp.example.com',
  port: 465,
  secure: true,
  tls: {
    rejectUnauthorized: false // Disables certificate validation
  }
}
```

## Testing Your Solution

1. Use the detailed diagnostic script: `node src/scripts/detailed-smtp-test.js`
2. Try with Gmail for verification: `./src/scripts/test-gmail.sh`
3. Test with the built-in test endpoint: `/api/v1/mail/test?email=your-email@example.com`

## Our Solution for Truehost

For Truehost SMTP server, we found this configuration works perfectly:

```typescript
transport: {
  host: "workplace.truehost.cloud",
  port: 587,
  secure: false, // STARTTLS for port 587
  auth: {
    user: "hr@propellanthr.com",
    pass: "4_JPw@+kT2L"
  },
  tls: {
    rejectUnauthorized: false
  }
}
```

The key was to:

1. Use port 587 instead of 465
2. Set `secure: false` for STARTTLS
3. Include `tls: { rejectUnauthorized: false }` to handle certificate issues

## If All Else Fails

Consider:

1. Contacting your SMTP provider's support team
2. Using a different email service provider
3. Setting up an email forwarding from a more reliable provider
