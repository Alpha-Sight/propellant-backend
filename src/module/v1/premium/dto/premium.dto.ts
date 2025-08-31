import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { SubscriptionTypeEnum } from 'src/common/enums/premium.enum';

export class SelectPlanDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(SubscriptionTypeEnum)
  plan: SubscriptionTypeEnum;

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
