import { Body, Controller, Post } from '@nestjs/common';
import { PremiumService } from './premium.service';
import { SelectPlanDto } from './dto/premium.dto';
import { UserDocument } from '../user/schemas/user.schema';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { RESPONSE_CONSTANT } from 'src/common/constants/response.constant';
import { ResponseMessage } from 'src/common/decorators/response.decorator';

@Controller('premium')
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Post()
  @ResponseMessage(RESPONSE_CONSTANT.PREMIUM.SELECT_PREMIUM_PLAN_SUCCESS)
  async selectPlan(
    @LoggedInUserDecorator() user: UserDocument,
    @Body() payload: SelectPlanDto,
  ) {
    return this.premiumService.selectPlan(user, payload);
  }

  @Post('process-upgrade')
  @ResponseMessage(RESPONSE_CONSTANT.PREMIUM.PROCESS_PREMIUM_PAYMENT_SUCCESS)
  async upgradeToPremium(
    @LoggedInUserDecorator() user: UserDocument,
    amountPaid: number,
    paymentObject: any,
  ) {
    return this.premiumService.upgradeToPremium(
      user._id.toString(),
      amountPaid,
      paymentObject,
    );
  }
}
