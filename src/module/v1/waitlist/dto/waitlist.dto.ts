import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { WaitlistInterestEnum } from '../../../../common/enums/waitlist.enum';

export class JoinWaitlistDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  institution: string;

  @IsString()
  @IsNotEmpty()
  skills: string;

  @IsArray()
  @IsEnum(WaitlistInterestEnum, {
    each: true,
    message: 'Please select valid interests',
  })
  @IsOptional()
  interest: WaitlistInterestEnum[];
}
