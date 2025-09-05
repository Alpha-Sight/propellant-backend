import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

// App Settings DTOs

export class UrlsDto {
  @IsUrl()
  webHomepage: string;

  @IsUrl()
  waitlistPage: string;
}

export class PointsDto {
  @IsNumber()
  referral: number;

  @IsNumber()
  signup: number;

  @IsNumber()
  premium: number;
}

export class SubscriptionPlanDto {
  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  price: number;

  @IsString()
  @IsOptional()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features: string[];
}

export class SubscriptionDto {
  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  FREE: SubscriptionPlanDto;

  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  BASIC: SubscriptionPlanDto;

  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  PROFESSIONAL: SubscriptionPlanDto;

  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  PREMIUM: SubscriptionPlanDto;

  @ValidateNested()
  @Type(() => SubscriptionPlanDto)
  ENTERPRISE: SubscriptionPlanDto;
}

export class AppSettingsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  supportEmail: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionPlanDto)
  subscriptionPlans: SubscriptionPlanDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => UrlsDto)
  urls: UrlsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PointsDto)
  points: PointsDto;
}

// Transfer Settings DTOs
// Main Settings DTO
export class UpdateSettingsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AppSettingsDto)
  app?: AppSettingsDto;
}

export class DeleteFromSettingsDto {
  @IsArray()
  @IsString({ each: true })
  keys: string[];
}
