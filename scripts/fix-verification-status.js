#!/usr/bin/env node
/*
  One-time script to fix existing credentials that have blockchainCredentialId
  but are missing verificationStatus field.
  Usage: MONGO_URL="mongodb://localhost:27017/propellantbd" node scripts/fix-verification-status.js
*/

const mongoose = require('mongoose');

async function main() {
  const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/propellantbd';

  await mongoose.connect(MONGO_URL, { connectTimeoutMS: 10000 });

  const coll = mongoose.connection.db.collection('credentials');

  // Find credentials that have blockchainCredentialId but no verificationStatus
  const credentials = await coll.find({
    blockchainCredentialId: { $exists: true },
    $or: [
      { verificationStatus: { $exists: false } },
      { verificationStatus: null }
    ]
  }).toArray();

  console.log(`Found ${credentials.length} credentials to update`);

  for (const cred of credentials) {
    const update = {
      verificationStatus: 'ISSUED', // Since they have blockchainCredentialId, they were issued
      updatedAt: new Date()
    };

    await coll.updateOne({ _id: cred._id }, { $set: update });
    console.log(`Updated credential ${cred._id}: set verificationStatus=ISSUED`);
  }

  console.log('Done updating existing credentials');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
