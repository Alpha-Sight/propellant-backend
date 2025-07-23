// This is a placeholder for the ABI of the CredentialVerificationModule contract
// Replace with actual ABI when available

export const CredentialVerificationModuleABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "subject", "type": "address" },
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "string", "name": "metadataURI", "type": "string" },
      { "internalType": "uint8", "name": "credentialType", "type": "uint8" },
      { "internalType": "uint256", "name": "validUntil", "type": "uint256" },
      { "internalType": "bytes32", "name": "evidenceHash", "type": "bytes32" },
      { "internalType": "bool", "name": "revocable", "type": "bool" }
    ],
    "name": "issueCredential",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "credentialId", "type": "uint256" }],
    "name": "verifyCredential",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "credentialId", "type": "uint256" }],
    "name": "getCredential",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "issuer", "type": "address" },
          { "internalType": "address", "name": "subject", "type": "address" },
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "string", "name": "description", "type": "string" },
          { "internalType": "uint8", "name": "status", "type": "uint8" }
        ],
        "internalType": "struct CredentialData",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "getCredentialsForSubject",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "ISSUER_ROLE",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  }
];
