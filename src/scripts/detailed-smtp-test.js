const nodemailer = require('nodemailer');
const tls = require('tls');
const net = require('net');
require('dotenv').config();

// Available TLS versions to test
const TLS_VERSIONS = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'];

async function testTlsConnection(host, port) {
  console.log(`\n--- Testing direct TLS connection to ${host}:${port} ---`);

  // Try direct socket connection first
  try {
    const socket = new net.Socket();
    await new Promise((resolve, reject) => {
      socket.connect(port, host, () => {
        console.log(`✅ TCP connection successful to ${host}:${port}`);
        socket.end();
        resolve();
      });
      socket.on('error', (err) => {
        console.error(
          `❌ TCP connection failed to ${host}:${port}:`,
          err.message,
        );
        reject(err);
      });
    });
  } catch (err) {
    console.error(`Could not establish basic TCP connection: ${err.message}`);
    return false;
  }

  // Test each TLS version
  for (const version of TLS_VERSIONS) {
    try {
      console.log(`\nTesting with ${version}...`);

      const options = {
        host,
        port,
        minVersion: version,
        maxVersion: version,
        rejectUnauthorized: false,
      };

      const tlsSocket = await new Promise((resolve, reject) => {
        const socket = tls.connect(options, () => {
          resolve(socket);
        });
        socket.on('error', (err) => {
          reject(err);
        });
        // Add timeout
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      console.log(`✅ Successfully connected using ${version}`);
      console.log(`Protocol: ${tlsSocket.getProtocol()}`);
      console.log(`Cipher: ${tlsSocket.getCipher().name}`);
      tlsSocket.end();
      return true;
    } catch (err) {
      console.error(`❌ Failed with ${version}: ${err.message}`);
    }
  }

  return false;
}

async function testSmtpWithMultipleConfigs() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  console.log('\n=== SMTP Server Information ===');
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log('Password: [hidden]\n');

  // First test TLS connection directly
  await testTlsConnection(host, port);

  // Test configurations
  const configs = [
    {
      name: 'Standard SSL (Port 465)',
      config: {
        host,
        port: 465,
        secure: true,
        auth: { user, pass: password },
        tls: { rejectUnauthorized: false },
      },
    },
    {
      name: 'STARTTLS (Port 587)',
      config: {
        host,
        port: 587,
        secure: false,
        auth: { user, pass: password },
        tls: { rejectUnauthorized: false },
      },
    },
    {
      name: 'Legacy SSL (with older cipher suite)',
      config: {
        host,
        port: 465,
        secure: true,
        auth: { user, pass: password },
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3',
          secureProtocol: 'TLSv1_method',
        },
      },
    },
    {
      name: 'Direct IP with SSL',
      config: {
        host: '102.212.247.98', // Hardcoded IP for Truehost
        port: 465,
        secure: true,
        auth: { user, pass: password },
        tls: { rejectUnauthorized: false },
      },
    },
    {
      name: 'Connection URL format',
      transportUrl: `smtps://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:465`,
    },
  ];

  // Test each configuration
  for (const { name, config, transportUrl } of configs) {
    console.log(`\n=== Testing: ${name} ===`);

    try {
      // Create transporter
      const transporter = transportUrl
        ? nodemailer.createTransport(transportUrl)
        : nodemailer.createTransport(config);

      // Attempt to verify connection
      console.log('Verifying connection...');
      const connected = await transporter.verify().catch((err) => {
        console.error(`❌ Verification error: ${err.message}`);
        return false;
      });

      if (connected) {
        console.log('✅ Connection verified successfully!');

        // Try sending a test email
        console.log('Sending test email...');
        const info = await transporter
          .sendMail({
            from: process.env.SMTP_FROM || `"Test" <${process.env.SMTP_EMAIL}>`,
            to: 'test@example.com', // Replace with your email for testing
            subject: 'SMTP Test',
            text: 'This is a test email from the diagnostics script.',
            html: '<b>This is a test email from the diagnostics script.</b>',
          })
          .catch((err) => {
            console.error(`❌ Send error: ${err.message}`);
            return null;
          });

        if (info) {
          console.log('✅ Email sent successfully!');
          console.log(`Message ID: ${info.messageId}`);
          return { success: true, config: config || transportUrl };
        }
      }
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
  }

  console.log('\n❌ All configurations failed.');
  return { success: false };
}

testSmtpWithMultipleConfigs()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Found working configuration!');
      console.log(JSON.stringify(result.config, null, 2));
    } else {
      console.log('\n❌ No working configuration found.');
      console.log('Suggestions:');
      console.log('1. Contact Truehost support to confirm exact SMTP settings');
      console.log(
        '2. Check if your network allows connections to SMTP ports (465/587)',
      );
      console.log('3. Try a different email service like SendGrid or Mailgun');
    }
  })
  .catch((err) => console.error('Test script error:', err));
