const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSmtpConnection() {
  console.log('Testing SMTP connection...');
  console.log(`Server: ${process.env.SMTP_HOST}`);
  console.log(`Port: ${process.env.SMTP_PORT}`);
  console.log(`User: ${process.env.SMTP_USER}`);

  // Create test account using Ethereal for testing
  let testAccount = await nodemailer.createTestAccount();

  // Create a test transporter
  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // Accept self-signed certificates
      minVersion: 'TLSv1.2', // Force modern TLS version
    },
    debug: true,
    logger: true
  });

  console.log('Verifying SMTP connection...');
  
  try {
    // Verify connection configuration
    await transporter.verify();
    console.log('Server is ready to take our messages');

    // Send mail with defined transport object
    let info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Test" <${process.env.SMTP_EMAIL}>`,
      to: 'testrecipient@example.com', // Change to a real email for testing
      subject: 'SMTP Connection Test',
      text: 'This is a test email to check the SMTP connection.',
      html: '<b>This is a test email to check the SMTP connection.</b>',
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('SMTP Error:', error);
    
    // Suggest solutions based on error type
    if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
      console.log('\nPossible solutions:');
      console.log('1. Check if port is blocked by firewall');
      console.log('2. Try using a different port (587 instead of 465)');
      console.log('3. Check if the server requires a different TLS version');
    } else if (error.code === 'EAUTH') {
      console.log('\nPossible solutions:');
      console.log('1. Check if username and password are correct');
      console.log('2. Check if the server requires specific authentication method');
    } else if (error.message.includes('certificate')) {
      console.log('\nPossible solutions:');
      console.log('1. Try setting `tls: { rejectUnauthorized: false }` option');
      console.log('2. Update ca certificates on your system');
    }
  }
}

testSmtpConnection().catch(console.error);
