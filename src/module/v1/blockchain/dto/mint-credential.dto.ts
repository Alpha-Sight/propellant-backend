import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export enum CredentialTypeEnum {
  EDUCATION = 0,
  CERTIFICATION = 1,
  EXPERIENCE = 2,
  SKILL = 3,
  ACHIEVEMENT = 4,
  REFERENCE = 5,
  OTHER = 6
}

export class MintCredentialDto {
  @IsString()
  subject: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  metadataURI: string;

  @IsEnum(CredentialTypeEnum)
  credentialType: CredentialTypeEnum;

  @IsNumber()
  @IsOptional()
  validUntil?: number; // Timestamp, 0 for no expiration

  @IsString()
  evidenceHash: string;

  @IsBoolean()
  revocable: boolean;
}