export class CredentialResponseDto {
  _id: string;
  credentialId: string;
  user: string;
  owner: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  issuer: string;
  issueDate?: Date;
  expiryDate?: Date;
  externalUrl?: string;
  verifyingOrganization?: string;
  verifyingEmail?: string;
  message?: string;
  visibility?: boolean;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  imageUrl?: string;
  createdAt: string;
  reviewedAt?: string;

  // Verification tracking fields
  verifiedBy?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  verificationNotes?: string;
  attestationStatus?: string;
  verificationRequestSentAt?: string;
  verificationDeadline?: string;

  // Blockchain fields
  blockchainCredentialId?: string;
  blockchainTransactionId?: string;
  blockchainStatus?:
    | 'NOT_MINTED'
    | 'PENDING_BLOCKCHAIN'
    | 'MINTED'
    | 'MINTING_FAILED';
  mintedAt?: string;

  // Keep existing fields for backward compatibility
  subject?: any;
  credentialType?: any;
  evidenceHash?: string;
  revocable?: boolean;
  updatedAt?: Date;
  ipfsHash?: string;
  issuingOrganization?: string;
}

export interface PaginatedCredentialResponse {
  data: CredentialResponseDto[];
  meta: {
    total: number;
    page: number;
    size: number;
    lastPage: number;
  };
}

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import {
  CredentialCategoryEnum,
  CredentialStatusEnum,
  CredentialTypeEnum,
  VerificationLevelEnum,
} from 'src/common/enums/credential.enum';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { Transform, Type } from 'class-transformer';

export class UploadCredentialDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(CredentialTypeEnum)
  @IsNotEmpty()
  type: CredentialTypeEnum;

  @IsEnum(CredentialCategoryEnum)
  @IsNotEmpty()
  category: CredentialCategoryEnum;

  @IsString()
  @IsOptional()
  url: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  visibility?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  file?: string;

  // Enhanced fields for verification
  @IsString()
  @IsNotEmpty()
  issuingOrganization: string;

  @IsString()
  @IsOptional()
  verifyingOrganization?: string;

  @IsString()
  @IsOptional()
  verifyingEmail?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsDateString()
  @IsNotEmpty()
  issueDate: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  externalUrl?: string;

  // Auto-minting control
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  autoMint?: boolean;
}

export class UpdateCredentialDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(CredentialTypeEnum)
  @IsOptional()
  type?: CredentialTypeEnum;

  @IsEnum(CredentialCategoryEnum)
  @IsOptional()
  category?: CredentialCategoryEnum;

  @IsString()
  @IsOptional()
  url?: string;

  @IsOptional()
  @IsBoolean()
  visibility?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsOptional()
  issuingOrganization?: string;

  @IsString()
  @IsOptional()
  verifyingOrganization?: string;

  @IsString()
  @IsOptional()
  verifyingEmail?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  externalUrl?: string;
}

export class UpdateCredentialStatusDto {
  @IsNotEmpty()
  @IsEnum(CredentialStatusEnum)
  status: CredentialStatusEnum;

  @IsOptional()
  @IsEnum(VerificationLevelEnum)
  verificationLevel?: VerificationLevelEnum;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

// New DTOs for verification process
export class VerifyCredentialDto {
  @IsEnum(['VERIFIED', 'REJECTED'])
  decision: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RetryMintingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class GetPendingVerificationsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  credentialType?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'verificationDeadline' | 'title';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
  email: any;
}

export class VerificationStatsResponseDto {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
  overdueVerifications: number;
  averageVerificationTime: number; // in hours
}

export class GetAllCredentialsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  verificationStatus?: string;

  @IsOptional()
  @IsString()
  verificationLevel?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  visibility?: boolean;

  @IsOptional()
  @IsString()
  blockchainStatus?: string;

  @IsOptional()
  @IsString()
  attestationStatus?: string;

  @IsOptional()
  @IsString()
  verifyingOrganization?: string;
  limit: number;
}
