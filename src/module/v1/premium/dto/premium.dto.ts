import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { SubscriptionTypeEnum } from 'src/common/enums/premium.enum';

export class SelectPlanDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(SubscriptionTypeEnum)
  plan: SubscriptionTypeEnum;
}
