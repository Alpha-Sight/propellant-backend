import { PartialType } from '@nestjs/mapped-types';
import {
  IsBooleanString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentProvidersEnum } from 'src/common/enums/payment.enum';
import { Transform } from 'class-transformer';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => {
    // Convert to lowercase to match enum values
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  })
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  fee: number; // Allow both number and string inputs

  @IsOptional()
  active: boolean; // Allow both boolean and string inputs

}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}

export class GetPaymentDto {
  @IsOptional()
  @IsString()
  currencyId: string;
}
