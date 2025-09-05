import 'dotenv/config';
import { BaseHelper } from '../src/common/utils/helper/helper.util';
import { ENVIRONMENT } from '../src/common/configs/environment';

const encryptionKeyFromEnv = ENVIRONMENT.APP.ENCRYPTION_KEY;
// Generate an Encryption Key (one-time)
// You can generate a secure 32-byte (256-bit) key using Node by running this command in the terminal:
// node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

if (!encryptionKeyFromEnv) {
  throw new Error('APP_ENCRYPTION_KEY is missing in .env');
}

// change 12345 to any string you want to encrypt
const encrypted = BaseHelper.encryptData(
  'sk_test_6ce39f58963d5613c20827a161c879bbaf789dfc',
  encryptionKeyFromEnv,
);

console.log('Paste this into .env:', encrypted);

// Run the Script in the terminal with the command:
// npx ts-node -r tsconfig-paths/register ./test/encrypt-test.ts

// copy the output and set the value to PAYSTACK_API_KEY in your .env file
// do the same for FLUTTERWAVE_API_KEY and VPAY_API_KEY
// Make sure to replace '12345' with your actual API keys when running the script.
