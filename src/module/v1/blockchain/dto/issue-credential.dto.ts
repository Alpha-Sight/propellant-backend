import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsEthereumAddress,
} from 'class-validator';

export enum CredentialTypeEnum {
  EDUCATION = 0,
  CERTIFICATION = 1,
  EXPERIENCE = 2,
  SKILL = 3,
  ACHIEVEMENT = 4,
  REFERENCE = 5,
  OTHER = 6,
}

export class IssueCredentialDto {
  @IsEthereumAddress()
  subject: string; // Wallet address of the credential recipient

  @IsString()
  name: string; // Human-readable name of the credential

  @IsString()
  description: string; // Detailed description of the credential

  @IsString()
  @IsOptional()
  metadataURI?: string; // URL pointing to credential metadata (JSON)

  @IsEnum(CredentialTypeEnum)
  credentialType: CredentialTypeEnum; // Type of credential (0-6)

  @IsNumber()
  @IsOptional()
  validUntil?: number; // Unix timestamp when credential expires (optional)

  @IsString()
  evidenceHash: string; // Hash of evidence supporting the credential

  @IsBoolean()
  revocable: boolean; // Whether the credential can be revoked
}