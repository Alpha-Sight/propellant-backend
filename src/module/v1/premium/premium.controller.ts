import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PremiumService } from './premium.service';
import { SelectPlanDto } from './dto/premium.dto';
import { UserDocument } from '../user/schemas/user.schema';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { RESPONSE_CONSTANT } from 'src/common/constants/response.constant';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
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
}
