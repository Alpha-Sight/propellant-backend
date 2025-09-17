const { BaseHelper } = require('../dist/common/utils/helper/helper.util');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get the raw private key from command line
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please provide the relayer private key as an argument');
  process.exit(1);
}

const privateKey = args[0];
const encryptionKey = process.env.APP_ENCRYPTION_KEY;

if (!encryptionKey) {
  console.error('ENCRYPTION_KEY not found in environment variables');
  process.exit(1);
}

// Encrypt the private key
const encrypted = BaseHelper.encryptData(privateKey, encryptionKey);
console.log('\nEncrypted Relayer Private Key:');
console.log(encrypted);
console.log('\nAdd this to your .env file as:');
console.log(`RELAYER_PRIVATE_KEY=${encrypted}`);
