export class CredentialResponseDto {
  _id: string;
  credentialId: string;
  title: string;              // Credential title (mapped from name)
  description?: string;       // Description
  type: string;              // Credential type (mapped from credentialType)
  category: string;          // Credential category
  issuer: string;            // Issuing organization (mapped from issuingOrganization)
  issueDate?: string;        // Issue date
  expiryDate?: string;       // Expiry date (optional)
  verifyingOrganization?: string;  // Verifying org name
  verifyingEmail?: string;         // Verifying org email
  message?: string;               // Additional notes
  externalUrl?: string;                   // External link
  visibility: boolean;           // Visibility setting
  status: "PENDING" | "VERIFIED" | "REJECTED";  // Verification status
  imageUrl?: string;            // URL to uploaded file
  createdAt: string;           // Creation timestamp
  verifiedAt?: string;         // Verification timestamp (when verified)
  
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
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  CredentialCategoryEnum,
  CredentialStatusEnum,
  CredentialTypeEnum,
  VerificationLevelEnum,
} from 'src/common/enums/credential.enum';
import { PaginationDto } from '../../repository/dto/repository.dto';

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
  externalUrl: string;

  @IsOptional()
  visibility?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  file?: string;

  // New fields for organizations and verification
  @IsOptional()
  @IsString()
  issuingOrganization?: string;

  @IsOptional()
  @IsString()
  verifyingOrganization?: string;

  @IsOptional()
  @IsString()
  verifyingEmail?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class UpdateCredentialDto {
  // @IsNotEmpty()
  // @IsString()
  // credentialId: string;

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
  externalUrl?: string;

  @IsOptional()
  visibility?: boolean;

  @IsOptional()
  @IsString()
  discription?: string;
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
  @IsString()
  visibility?: string;
}
