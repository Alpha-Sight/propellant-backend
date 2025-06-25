import { IsEnum, IsString } from 'class-validator';
import { PlanTypeEnum } from 'src/common/enums/premium.enum';

export class SelectPlanDto {
  @IsString()
  @IsEnum(PlanTypeEnum)
  plan: PlanTypeEnum;
}
