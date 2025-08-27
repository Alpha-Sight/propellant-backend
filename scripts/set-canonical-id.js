#!/usr/bin/env node
/*
  Usage examples:
  MONGO_URL="mongodb://localhost:27017/propellantbd" \
  BLOCKCHAIN_RPC_URL="https://rpc.sepolia-api.lisk.com" \
  CREDENTIAL_VERIFICATION_MODULE_ADDRESS="0x700fe280deF52455494603A8584425eE47D2FDF0" \
  ISSUE_TX="0xa11ace51d72a7cf33763849c0d975dda9c7565696ed4b1797935b4a321e26157" \
  node scripts/set-canonical-id.js

  Or provide CANONICAL_ID directly:
  MONGO_URL="mongodb://localhost:27017/propellantbd" ISSUE_TX="0x..." CANONICAL_ID="10" node scripts/set-canonical-id.js
*/

const mongoose = require('mongoose');
const { ethers } = require('ethers');

async function main() {
  const MONGO_URL = process.env.MONGO_URL;
  const ISSUE_TX = process.env.ISSUE_TX;
  const BLOCKCHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC_URL;
  const CREDENTIAL_VERIFICATION_MODULE_ADDRESS = process.env.CREDENTIAL_VERIFICATION_MODULE_ADDRESS;
  let CANONICAL_ID = process.env.CANONICAL_ID;

  if (!MONGO_URL) {
    console.error('MONGO_URL is required');
    process.exit(2);
  }
  if (!ISSUE_TX) {
    console.error('ISSUE_TX is required');
    process.exit(2);
  }

  if (!CANONICAL_ID) {
    if (!BLOCKCHAIN_RPC_URL || !CREDENTIAL_VERIFICATION_MODULE_ADDRESS) {
      console.error('When CANONICAL_ID is not provided, BLOCKCHAIN_RPC_URL and CREDENTIAL_VERIFICATION_MODULE_ADDRESS are required');
      process.exit(2);
    }

    console.log('Fetching receipt to derive canonical id from topics[1]...');
    const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_RPC_URL);
    const receipt = await provider.getTransactionReceipt(ISSUE_TX);
    if (!receipt) {
      console.error('No receipt found for tx', ISSUE_TX);
      process.exit(3);
    }

    // find a log from the credential module address
    const found = receipt.logs.find((l) => l.address && l.address.toLowerCase() === CREDENTIAL_VERIFICATION_MODULE_ADDRESS.toLowerCase());
    if (!found) {
      console.error('No logs from credential module address found in receipt. Logs:', JSON.stringify(receipt.logs, null, 2));
      process.exit(4);
    }

    if (!found.topics || found.topics.length < 2) {
      console.error('Log does not have indexed topics to extract id. Raw log:', JSON.stringify(found, null, 2));
      process.exit(5);
    }

    const possibleIdHex = found.topics[1];
    try {
      const bn = ethers.toBigInt(possibleIdHex);
      CANONICAL_ID = bn.toString();
      console.log('Derived numeric canonical id from topics[1]:', CANONICAL_ID);
    } catch (e) {
      CANONICAL_ID = possibleIdHex;
      console.log('Derived hex canonical id from topics[1]:', CANONICAL_ID);
    }
  }

  // Connect to Mongo and update credential document
  console.log('Connecting to Mongo...');
  await mongoose.connect(MONGO_URL, { connectTimeoutMS: 10000 });

  const coll = mongoose.connection.db.collection('credentials');

  // Try to find by transactionHash (case-insensitive)
  const query = { transactionHash: { $regex: ISSUE_TX.replace(/^0x/, ''), $options: 'i' } };
  const credential = await coll.findOne(query);
  if (!credential) {
    console.error('No credential document found with transactionHash matching', ISSUE_TX);
    console.error('You can search the collection manually or relax the query. Example: db.credentials.find({})');
    await mongoose.disconnect();
    process.exit(6);
  }

  const update = { $set: { tokenId: null, blockchainCredentialId: null } };

  // If CANONICAL_ID is a decimal string numeric, store as blockchainCredentialId when safe
  if (/^\d+$/.test(String(CANONICAL_ID))) {
    const big = BigInt(CANONICAL_ID);
    if (big <= BigInt(Number.MAX_SAFE_INTEGER)) {
      update.$set.blockchainCredentialId = Number(CANONICAL_ID);
    } else {
      // too large, store as string in tokenId
      update.$set.tokenId = String(CANONICAL_ID);
    }
  } else {
    // treat as hex string
    update.$set.tokenId = String(CANONICAL_ID);
  }

  // also set verificationStatus to ISSUED if not already
  update.$set.verificationStatus = credential.verificationStatus === 'ISSUED' ? credential.verificationStatus : 'ISSUED';

  const res = await coll.updateOne({ _id: credential._id }, update);
  console.log('Updated credential _id=', credential._id.toString(), ' matchedCount=', res.matchedCount, ' modifiedCount=', res.modifiedCount);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
