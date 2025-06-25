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

export class AppSettingsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  supportEmail: string;

  @IsNumber()
  @IsNotEmpty()
  premiumPricing: number;

  @IsObject()
  @ValidateNested()
  @Type(() => UrlsDto)
  urls: UrlsDto;
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
