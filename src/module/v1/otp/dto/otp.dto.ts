import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';
import { OtpTypeEnum } from '../../../../common/enums/otp.enum';

export class RequestOtpDto {
  @IsEnum(OtpTypeEnum)
  type: OtpTypeEnum;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @IsNumber()
  code: number;
}

export class CreateOtpDto extends RequestOtpDto {
  @IsNumber()
  code: number;
}
