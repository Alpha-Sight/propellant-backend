## 📋 **New API Endpoints Overview**

### 1. **Main Verification Endpoint** ✨
```
POST /credentials/:id/verify
```

**Request Body:**
```json
{
  "decision": "VERIFIED" | "REJECTED",
  "notes": "Optional verification notes (max 500 chars)"
}
```

**Response (Approved & Minted):**
```json
{
  "success": true,
  "message": "Credential verification processed successfully",
  "data": {
    "status": "VERIFIED",
    "minted": true,
    "transactionId": "0x1234...abcd",
    "message": "Credential verified and queued for blockchain minting"
  }
}
```

**Response (Approved but Minting Failed):**
```json
{
  "success": true,
  "message": "Credential verification processed successfully",
  "data": {
    "status": "VERIFIED", 
    "minted": false,
    "message": "Credential verified but minting failed. Can be retried later."
  }
}
```

**Response (Rejected):**
```json
{
  "success": true,
  "message": "Credential verification processed successfully", 
  "data": {
    "status": "REJECTED",
    "minted": false,
    "message": "Credential has been rejected"
  }
}
```

---

### 2. **Enhanced Retry Minting** 🔄
```
POST /credentials/:id/retry-minting
```

**Request Body:** *(No body required)*

**Response:**
```json
{
  "success": true,
  "message": "Credential minting retry initiated",
  "data": {
    "message": "Credential minting retry initiated successfully",
    "transactionId": "0x5678...efgh"
  }
}
```

---

### 3. **Enhanced Blockchain Status** 📊
```
GET /credentials/blockchain-status
```

**Response:**
```json
{
  "success": true,
  "message": "Blockchain status retrieved successfully",
  "data": {
    "totalVerified": 5,
    "minted": 3,
    "pending": 1, 
    "failed": 1,
    "credentials": [
      {
        "_id": "64f8a1b2c3d4e5f6g7h8i9j0",
        "title": "Software Engineering Certificate",
        "blockchainStatus": "MINTED",
        "transactionId": "0x1234...abcd",
        "mintingStartedAt": "2025-09-01T10:30:00.000Z",
        "createdAt": "2025-08-30T09:15:00.000Z"
      }
    ]
  }
}
```

---

### 4. **Resend Verification Request** 📧
```
POST /credentials/:id/resend-verification
```

**Response:**
```json
{
  "success": true,
  "message": "Verification request resent successfully",
  "data": {
    "message": "Verification request resent successfully"
  }
}
```

---

## 🔗 **Blockchain Integration Details**

### **Onchain Data Mapping**

The implementation maps your credential data to the blockchain parameters as follows:

```typescript
// When a credential is VERIFIED, this data goes onchain:
{
  "subject": user.walletAddress,              // User's wallet address
  "name": credential.title,                   // Credential title
  "description": credential.description || "", // Credential description  
  "metadataURI": credential.fileUrl || "",    // IPFS/file URL
  "credentialType": mapCredentialType(credential.type), // 0-4 enum
  "validUntil": Math.floor(Date.now() / 1000) + 31536000, // 1 year validity
  "evidenceHash": keccak256(credential._id),  // MongoDB ID hash
  "revocable": true                           // Always revocable
}
```

### **Credential Type Mapping:**
```typescript
{
  'EDUCATION': 0,
  'EXPERIENCE': 1, 
  'SKILL': 2,
  'CERTIFICATION': 3,
  'OTHER': 4
}
```

---

## 🔐 **Role-Based Access Control**

### **Who Can Verify Credentials:**
- ✅ **SUPER_ADMIN** - Can verify any credential
- ✅ **ADMIN** - Can verify any credential  
- ✅ **ORGANIZATION** - Can verify credentials (with org-specific rules)
- ❌ **TALENT** - Cannot verify credentials

### **Error Response for Unauthorized Users:**
```json
{
  "success": false,
  "message": "You do not have permission to verify this credential. Only Admin, Super Admin, or authorized Organizations can verify credentials.",
  "statusCode": 403
}
```

---

## 📧 **Enhanced Notification System**

### **Email Notifications Sent:**

1. **Credential Approved** → User gets approval email
2. **Credential Rejected** → User gets rejection email with reason
3. **Minting Error** → User gets notification about minting issue
4. **NFT Minted** → User gets success notification (via blockchain events)

---

## 🔄 **Complete Flow Example**

### **Scenario: Admin Approves a Credential**

**1. Admin makes verification request:**
```bash
POST /credentials/64f8a1b2c3d4e5f6g7h8i9j0/verify
{
  "decision": "VERIFIED",
  "notes": "All documents are valid and verified"
}
```

**2. System Response:**
```json
{
  "success": true,
  "data": {
    "status": "VERIFIED",
    "minted": true,
    "transactionId": "0x7890...ijkl",
    "message": "Credential verified and queued for blockchain minting"
  }
}
```

**3. Background Process:**
- ✅ Credential status updated to `VERIFIED`
- ✅ Email notification sent to user
- ✅ Blockchain transaction queued via `RelayerService`
- ✅ Transaction data: `issueCredential(userWallet, "Certificate Name", "Description", "ipfs://...", 3, 1756637400, "0x1234...", true)`

**4. Blockchain Result:**
- ✅ NFT minted with your specified parameters
- ✅ Credential gets `blockchainCredentialId` from contract
- ✅ User receives NFT in their wallet

---

## ⚠️ **Error Scenarios Handled**

### **Common Error Responses:**

**Credential Not Found:**
```json
{
  "success": false,
  "message": "Credential not found",
  "statusCode": 404
}
```

**Already Processed:**
```json
{
  "success": false, 
  "message": "Credential is not pending verification",
  "statusCode": 400
}
```

**No Wallet Address:**
```json
{
  "success": true,
  "data": {
    "status": "VERIFIED",
    "minted": false,
    "message": "Credential verified. User needs to set up wallet for NFT minting."
  }
}
```

---

This implementation fully accounts for your onchain requirements and provides a robust API for credential verification with proper blockchain integration! 🚀