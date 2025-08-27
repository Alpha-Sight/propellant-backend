/*
 Reconcile verification statuses in MongoDB with on-chain credential state.
 Usage:
   cd propellant-backend
   npm install dotenv ethers mongodb
   MONGO_URL="mongodb://..." BLOCKCHAIN_RPC_URL="https://..." CREDENTIAL_VERIFICATION_MODULE_ADDRESS="0x..." node scripts/reconcile-verifications.js

 Notes:
 - The script reads the `credentials` collection directly and expects fields:
   - blockchainCredentialId (number or numeric string)
   - verificationStatus
 - It calls `getCredential(uint256)` on the on-chain module and maps the returned tuple to determine state.
 - Adjust ABI or field mapping if your contract's getter has a different signature.
*/

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { ethers } = require('ethers');

const MONGO_URL = process.env.MONGO_URL;
const RPC = process.env.BLOCKCHAIN_RPC_URL;
const MODULE = process.env.CREDENTIAL_VERIFICATION_MODULE_ADDRESS;

if (!MONGO_URL || !RPC || !MODULE) {
  console.error('Missing required env vars. Set MONGO_URL, BLOCKCHAIN_RPC_URL, and CREDENTIAL_VERIFICATION_MODULE_ADDRESS');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC);

// Minimal ABI for getCredential(uint256)
const abi = [
  'function getCredential(uint256 credentialId) view returns (tuple(address issuer, address subject, string name, string description, uint8 status))'
];

const contract = new ethers.Contract(MODULE, abi, provider);

(async () => {
  const client = new MongoClient(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    const db = client.db();
    const coll = db.collection('credentials');

    // Find records that are marked VERIFIED or PENDING_BLOCKCHAIN (possible mismatches)
    const cursor = coll.find({ verificationStatus: { $in: ['VERIFIED', 'PENDING_BLOCKCHAIN'] } });

    let processed = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      processed += 1;
      const idCandidate = doc.blockchainCredentialId || doc.credentialId;
      let numericId = null;
      if (typeof idCandidate === 'number') numericId = idCandidate;
      else if (typeof idCandidate === 'string') {
        const clean = idCandidate.replace(/[^0-9]/g, '');
        numericId = parseInt(clean);
      }

      if (!numericId || isNaN(numericId) || numericId <= 0) {
        console.warn(`Skipping doc ${doc._id} because blockchainCredentialId invalid: ${idCandidate}`);
        continue;
      }

      try {
        const oc = await contract.getCredential(numericId);
        // oc is tuple: { issuer, subject, name, description, status }
        const onchainStatus = oc && oc.status !== undefined ? Number(oc.status) : null;

        // Map on-chain enum to DB status (adjust to your contract enum)
        // 0 = PENDING, 1 = ISSUED, 2 = VERIFIED, 3 = REVOKED
        let mapped = 'UNKNOWN';
        switch (onchainStatus) {
          case 0: mapped = 'PENDING'; break;
          case 1: mapped = 'ISSUED'; break;
          case 2: mapped = 'VERIFIED'; break;
          case 3: mapped = 'REVOKED'; break;
          default: mapped = 'UNKNOWN';
        }

        if (mapped === 'UNKNOWN') {
          console.log(`Doc ${doc._id} (${numericId}) on-chain status unknown (${onchainStatus}). Skipping.`);
          continue;
        }

        // If DB disagrees with on-chain, update DB
        if (doc.verificationStatus !== mapped) {
          console.log(`Updating ${doc._id}: DB=${doc.verificationStatus} -> OnChain=${mapped}`);
          const update = { verificationStatus: mapped, updatedAt: new Date() };
          if (mapped === 'VERIFIED') update.verifiedAt = new Date();
          if (mapped === 'REVOKED') update.revokedAt = new Date();
          await coll.updateOne({ _id: doc._id }, { $set: update });
        } else {
          console.log(`No change for ${doc._id} (${numericId}) status=${mapped}`);
        }
      } catch (err) {
        console.error(`Error reading on-chain credential ${numericId} for doc ${doc._id}:`, err.message || err);
      }
    }

    console.log(`Processed ${processed} credential records.`);
  } catch (err) {
    console.error('Reconciliation failed:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.close();
  }
})();
