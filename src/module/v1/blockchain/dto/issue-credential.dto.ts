import { IsString, IsNotEmpty, IsOptional, IsArray, IsDateString } from 'class-validator';

export class IssueCredentialDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  metadataURI?: string;

  @IsString()
  @IsNotEmpty()
  credentialType: string;

  @IsDateString()
  @IsOptional()
  validUntil?: Date;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  @IsOptional()
  evidenceHash?: string;

  @IsOptional()
  revocable?: boolean;

  @IsString()
  @IsOptional()
  externalId?: string;
}
