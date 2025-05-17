import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRoleEnum } from 'src/common/enums/user.enum';

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsNumber()
  code: number;
}

export class RequestVerifyEmailOtpDto {
  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto extends LoginDto {
  @IsNumber()
  code: number;

  @IsString()
  confirmPassword: string;
}

export class GoogleAuthDto {
  @IsEmail()
  email: string;
}

export class WalletLoginDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsNotEmpty()
  @IsString()
  walletAddress: string;

  @IsString()
  signature: string;

  @IsString()
  nonce: string;

  @IsNotEmpty()
  @IsString()
  role: UserRoleEnum;
}
