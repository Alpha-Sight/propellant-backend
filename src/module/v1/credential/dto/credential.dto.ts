import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  CredentialStatusEnum,
  CredentialTypeEnum,
  VerificationLevelEnum,
} from 'src/common/enums/credential.enum';

export class UploadCredentialDto {
  @IsEnum(CredentialTypeEnum)
  type: CredentialTypeEnum;

  @IsString()
  @IsNotEmpty()
  issuer: string;

  @IsString()
  @IsNotEmpty()
  verificationReference: string;

  @IsOptional()
  visibility?: boolean;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
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
