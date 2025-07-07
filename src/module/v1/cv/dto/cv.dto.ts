import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUrl,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { SkillLevelEnum } from 'src/common/enums/cv.enum';

export class ExperienceDto {
  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsBoolean()
  isCurrentRole?: boolean;
}

export class EducationDto {
  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  degree?: string;

  @IsString()
  @IsOptional()
  fieldOfStudy?: string;

  @IsString()
  @IsOptional()
  startDate: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SkillDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEnum(SkillLevelEnum)
  level?: SkillLevelEnum;

  // @IsOptional()
  // @IsString()
  // category?: string;
}

export class CertificationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  issuer?: string;

  @IsString()
  @IsOptional()
  dateIssued?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  credentialId?: string;

  @IsOptional()
  @IsUrl()
  credentialUrl?: string;
}

export class ProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];

  @IsOptional()
  @IsUrl()
  project?: string;

  @IsOptional()
  @IsUrl()
  link?: string;
}

export class SocialsDto {
  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;
}

export class GenerateCVDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  professionalTitle?: string;

  @IsOptional()
  @IsString()
  professionalSummary?: string;

  @IsOptional()
  @IsString()
  address?: string;

  // @IsOptional()
  // @IsString()
  // github?: string;

  // @IsOptional()
  // @IsString()
  // portfolio?: string;

  // @IsOptional()
  // @IsString()
  // website?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  workExperience?: ExperienceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education?: EducationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  skills?: SkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications?: CertificationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  projects?: ProjectDto[];

  // @IsOptional()
  // @IsArray()
  // @IsString({ each: true })
  // languages?: string[];

  // @IsOptional()
  // @IsArray()
  // @IsString({ each: true })
  // hobbies?: string[];

  // @IsOptional()
  // @IsArray()
  // @IsString({ each: true })
  // achievements?: string[];

  // @IsOptional()
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => SocialsDto)
  // socials?: SocialsDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  references?: string[];
}
