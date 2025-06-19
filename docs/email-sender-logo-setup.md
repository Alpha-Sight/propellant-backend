# Setting Up Your Logo as Email Sender Image

To display your logo alongside your sent emails in clients like Gmail, Yahoo Mail, or Apple Mail, you need to implement BIMI (Brand Indicators for Message Identification).

## Prerequisites

1. ✓ Properly configured SPF, DKIM, and DMARC records (you already have these set up)
2. A properly formatted logo image
3. A BIMI DNS record
4. (Optional but recommended) A Verified Mark Certificate (VMC)

## Step 1: Prepare Your Logo Image

Your logo needs to be in the correct format:

1. Convert your logo to an SVG file in SVG Tiny Portable/Secure (SVG P/S) format
2. Square dimensions with equal width and height
3. The image should fully fill the square canvas
4. Add a small padding to prevent cropping
5. File size should be under 32KB

Let's create a script to prepare your logo:

```bash
#!/bin/bash

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is required but not installed. Please install it first."
    echo "brew install imagemagick"
    exit 1
fi

# Check if svgcleaner is installed
if ! command -v svgcleaner &> /dev/null; then
    echo "svgcleaner is required but not installed. Please install it first."
    echo "brew install svgcleaner"
    exit 1
fi

# Source and destination paths
SOURCE_LOGO="public/logo.jpg"
SVG_OUTPUT="public/logo-bimi.svg"
PNG_TEMP="public/logo-temp.png"

# Create a square PNG with padding
convert "$SOURCE_LOGO" -resize 512x512 -background white -gravity center -extent 512x512 "$PNG_TEMP"

# Convert to SVG
convert "$PNG_TEMP" "$SVG_OUTPUT"

# Clean and optimize SVG
svgcleaner "$SVG_OUTPUT" "$SVG_OUTPUT" --multipass

# Cleanup temp file
rm "$PNG_TEMP"

echo "BIMI-ready logo created at: $SVG_OUTPUT"
echo "Please upload this file to a publicly accessible URL"
```

## Step 2: Host Your Logo

1. Upload your prepared SVG logo to a publicly accessible HTTPS URL
2. Ensure the server serves the file with the correct MIME type: `image/svg+xml`
3. Example hosting options:
   - Your own web server
   - CDN like Cloudflare
   - GitHub Pages

## Step 3: Add BIMI DNS Record

Add this TXT record to your DNS configuration:

```
Name: default._bimi.propellanthr.com
Type: TXT
Value: v=BIMI1; l=https://example.com/logo-bimi.svg; a=;
```

Replace `https://example.com/logo-bimi.svg` with the actual URL of your hosted SVG logo.

## Step 4: Verify BIMI Setup

1. Use the BIMI Inspector tool at https://bimigroup.org/bimi-generator/ to verify your setup
2. Check all requirements are met:
   - Valid DMARC policy with p=quarantine or p=reject
   - Valid SPF and DKIM authentication
   - Proper BIMI record format
   - Accessible and correctly formatted SVG logo

## Step 5: Add Logo to Email Headers (Optional Enhancement)

While BIMI works automatically when properly configured, you can also add logo references to your email headers:

```typescript
// Add this to your mail.service.ts file
headers: {
  // ...existing headers
  'X-Entity-Ref-ID': 'propellanthr.com',
  'X-Logo': 'https://example.com/logo-bimi.svg'
}
```

## Important Notes

1. **BIMI Implementation Timeline**: Even with perfect configuration, it may take days or weeks for email clients to start displaying your logo
2. **VMC Requirement**: Gmail specifically requires a Verified Mark Certificate for BIMI, which involves registering your logo as a trademark
3. **Client Support**: Not all email clients support BIMI yet
4. **Alternative Method**: For simpler but less reliable logo display, consider creating an email signature with your logo embedded

## Obtaining a Verified Mark Certificate (VMC) - For Full Gmail Support

1. Register your logo as a trademark (if not already done)
2. Purchase a VMC from a provider like DigiCert or Entrust
3. Update your BIMI record to include the certificate:

```
v=BIMI1; l=https://example.com/logo-bimi.svg; a=https://example.com/bimi-certificate.pem;
```

## Alternative: Email Signature with Logo

If BIMI setup is too complex for your current needs, you can add a logo to all outgoing emails by modifying your email templates to include an embedded logo in the signature:

```html
<!-- Add this to your email template HTML -->
<div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
  <table cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="vertical-align: middle; padding-right: 10px;">
        <img
          src="https://propellanthr.com/logo.jpg"
          alt="Propellant HR"
          width="48"
          height="48"
          style="border-radius: 4px;"
        />
      </td>
      <td
        style="vertical-align: middle; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4;"
      >
        <div style="font-weight: bold; color: #0056b3;">Propellant HR Team</div>
        <div style="color: #666;">
          support@propellanthr.com | propellanthr.com
        </div>
      </td>
    </tr>
  </table>
</div>
```

## Additional Resources

- BIMI Group Official Website: https://bimigroup.org/
- BIMI Validator Tool: https://bimigroup.org/bimi-generator/
- VMC Information: https://bimigroup.org/verified-mark-certificates-vmc/
