import { IsNotEmpty, IsString } from 'class-validator';

export class SelectPlanDto {
  @IsString()
  @IsNotEmpty()
  plan: string;

  // @IsString()
  // @IsNotEmpty()
  // @IsEnum(CardTypeEnum)
  // cardType: CardTypeEnum;

  // @IsString()
  // @IsNotEmpty()
  // cardNumber: string;

  // @IsDateString()
  // @IsNotEmpty()
  // expiryDate: Date;

  // @IsNumber()
  // @IsNotEmpty()
  // cvv: number;

  // @IsString()
  // @IsNotEmpty()
  // cardName: string;
}
