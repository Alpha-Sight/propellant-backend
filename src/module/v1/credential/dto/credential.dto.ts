export class CredentialResponseDto {
  _id: string;
  credentialId: string;
  subject: any;
  issuer: any;
  name: string;
  description?: string;
  credentialType: any;
  evidenceHash?: string;
  revocable: boolean;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  ipfsHash?: string;
  imageUrl?: string;
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
  url: string;

  @IsOptional()
  visibility?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  file?: string;
}

export class UpdateCredentialDto {
  @IsNotEmpty()
  @IsString()
  credentialId: string;

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
