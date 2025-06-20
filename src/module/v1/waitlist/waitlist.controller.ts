import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/waitlist.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { ResponseMessage } from '../../../common/decorators/response.decorator';
import { RESPONSE_CONSTANT } from '../../../common/constants/response.constant';
import { PaginationDto } from '../repository/dto/repository.dto';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../../../common/decorators/role.decorator';
import { UserRoleEnum } from '../../../common/enums/user.enum';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @ResponseMessage(RESPONSE_CONSTANT.WAITLIST.JOIN_WAITLIST_SUCCESS)
  @Post()
  joinWaitlist(@Body() payload: JoinWaitlistDto) {
    return this.waitlistService.joinWaitlist(payload);
  }

  @Public()
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN)
  @Get()
  allEntries(@Query() query: PaginationDto) {
    return this.waitlistService.allEntries(query);
  }
}
