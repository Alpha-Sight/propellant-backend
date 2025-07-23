export enum TransactionStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING', 
  COMPLETED = 'COMPLETED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  Failed = "Failed",
}

export enum PaymentStatusEnum {
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
}

export enum TransactionTypeEnum {
  AccountCreation = 'ACCOUNT_CREATION',
  CredentialIssuance = 'CREDENTIAL_ISSUANCE',
  CredentialVerification = 'CREDENTIAL_VERIFICATION',
  CredentialRevocation = 'CREDENTIAL_REVOCATION',
  Premium = "Premium",
}

