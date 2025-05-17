import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
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
  coursesPage: string;
}

export class AppSettingsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  supportEmail: string;

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
