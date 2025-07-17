import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsOptional,
} from 'class-validator';
import { JobTypeEnum } from 'src/common/enums/organization.enum';
import { PaginationDto } from '../../repository/dto/repository.dto';

export class CreateJobPostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  salaryRange: string;

  @IsEnum(JobTypeEnum)
  jobType: JobTypeEnum;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];
}

export class GetAllJobPostsDto extends PaginationDto {
  @IsOptional()
  jobType?: string;

  @IsOptional()
  status?: string;

  @IsOptional()
  location?: string;

  @IsOptional()
  visibility?: boolean;

  @IsOptional()
  searchQuery?: string;
}

export class UpdateJobPostDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  location: string;

  @IsString()
  @IsOptional()
  salaryRange: string;

  @IsEnum(JobTypeEnum)
  jobType: JobTypeEnum;

  @IsString()
  @IsOptional()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];
}
