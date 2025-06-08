export enum TransactionStatusEnum {
    PENDING = 'PENDING',
    PENDING_CONFIRMATION = 'PENDING_CONFIRMATION', // Added for clarity after submission
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    RETRY = 'RETRY', // Optional: if you implement retries
  }