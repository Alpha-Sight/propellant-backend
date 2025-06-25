import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentProvidersEnum } from 'src/common/enums/payment.enum';
import { BaseHelper } from 'src/common/utils/helper/helper.util';

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

  @IsOptional()
  @IsString()
  @Transform((data) => {
    return BaseHelper.encryptData(data.value);
  })
  apiKey: string;
}

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {}

export class GetPaymentDto {
  @IsOptional()
  @IsString()
  currencyId: string;
}
