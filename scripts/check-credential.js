#!/usr/bin/env node
/*
  Quick script to check credential status in DB.
  Usage: MONGO_URL="mongodb://localhost:27017/propellantbd" CREDENTIAL_ID="68af5cbce980e2e288c06b8f" node scripts/check-credential.js
*/

const mongoose = require('mongoose');

async function main() {
  const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/propellantbd';
  const CREDENTIAL_ID = process.env.CREDENTIAL_ID;

  if (!CREDENTIAL_ID) {
    console.error('CREDENTIAL_ID is required (Mongo ObjectId)');
    process.exit(2);
  }

  await mongoose.connect(MONGO_URL, { connectTimeoutMS: 10000 });

  const coll = mongoose.connection.db.collection('credentials');
  const credential = await coll.findOne({ _id: new mongoose.Types.ObjectId(CREDENTIAL_ID) });

  if (!credential) {
    console.error('Credential not found');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Credential status:');
  console.log(JSON.stringify({
    _id: credential._id,
    verificationStatus: credential.verificationStatus,
    blockchainCredentialId: credential.blockchainCredentialId,
    tokenId: credential.tokenId,
    transactionHash: credential.transactionHash,
    createdAt: credential.createdAt,
    verificationRequestedAt: credential.verificationRequestedAt
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
