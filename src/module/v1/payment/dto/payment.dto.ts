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

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsEnum(PaymentProvidersEnum)
  name: PaymentProvidersEnum;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsNumberString()
  fee: number;

  @IsOptional()
  @IsBooleanString()
  active: boolean;

}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}

export class GetPaymentDto {
  @IsOptional()
  @IsString()
  currencyId: string;
}
