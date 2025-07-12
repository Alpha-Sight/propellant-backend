export enum TransactionStatusEnum {
    PENDING = 'PENDING',
    PENDING_CONFIRMATION = 'PENDING_CONFIRMATION', // Added for clarity after submission
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    RETRY = 'RETRY', // Optional: if you implement retries
  }
//   Pending = 'Pending',
//   Completed = 'Completed',
//   Failed = 'Failed',
// }

export enum PaymentStatusEnum {
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
}

export enum TransactionTypeEnum {
  Premium = 'Premium',
  AccountCreation = 'AccountCreation',
}

