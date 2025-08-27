/*
Parse a mined issue transaction and print CredentialIssued event args.
Usage:
  BLOCKCHAIN_RPC_URL="https://..." CREDENTIAL_VERIFICATION_MODULE_ADDRESS="0x..." ISSUE_TX="0x..." node scripts/parse-issue-event.js
*/
require('dotenv').config();
const { ethers } = require('ethers');

const RPC = process.env.BLOCKCHAIN_RPC_URL;
const MODULE = process.env.CREDENTIAL_VERIFICATION_MODULE_ADDRESS;
const ISSUE_TX = process.env.ISSUE_TX;

if (!RPC || !MODULE || !ISSUE_TX) {
  console.error('Set BLOCKCHAIN_RPC_URL, CREDENTIAL_VERIFICATION_MODULE_ADDRESS and ISSUE_TX');
  process.exit(1);
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const receipt = await provider.getTransactionReceipt(ISSUE_TX);
  if (!receipt) {
    console.error('No receipt found for', ISSUE_TX);
    process.exit(2);
  }

  console.log('Receipt blockNumber:', receipt.blockNumber, 'logs:', receipt.logs.length);

  // Try multiple event signatures
  const ifaces = [
    new ethers.Interface(['event CredentialIssued(uint256 indexed credentialId, address indexed subject, address indexed issuer)']),
    new ethers.Interface(['event CredentialIssued(bytes32 indexed id, address indexed subject, address indexed issuer, uint8 credentialType)']),
    new ethers.Interface(['event CredentialIssued(bytes32 indexed id, address indexed subject, address indexed issuer)'])
  ];

  let found = false;
  for (const log of receipt.logs) {
    for (const iface of ifaces) {
      try {
        const parsed = iface.parseLog({ topics: Array.from(log.topics || []), data: log.data });
        if (parsed && parsed.name === 'CredentialIssued') {
          found = true;
          console.log('Found CredentialIssued event via ABI:', iface.format());
          console.log('args:', parsed.args);
          // Normalize id to hex string or decimal
          const id = parsed.args[0];
          if (typeof id === 'bigint' || (id && id._isBigNumber)) {
            console.log('Canonical on-chain id (uint256):', id.toString());
          } else {
            console.log('Canonical on-chain id (bytes32):', id.toString());
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (!found) {
    console.log('No CredentialIssued event found in receipt logs. Dumping raw logs for inspection:');
    console.log(JSON.stringify(receipt.logs, null, 2));
    process.exit(3);
  }

  process.exit(0);
})();
