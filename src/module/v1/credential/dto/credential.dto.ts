import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CredentialTypeEnum } from 'src/common/enums/credential.enum';

export class UploadCredentialDto {
  @IsEnum(CredentialTypeEnum)
  credentialType: CredentialTypeEnum;

  @IsString()
  @IsNotEmpty()
  issuer: string;

  @IsString()
  @IsNotEmpty()
  file: string;

  @IsString()
  @IsNotEmpty()
  verificationReference: string;

  @IsOptional()
  visibility?: boolean;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}
