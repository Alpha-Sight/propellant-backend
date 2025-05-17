import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { SettingService } from './setting.service';
import { RoleGuard } from '../auth/guards/role.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/role.decorator';
import { UserRoleEnum } from '../../../common/enums/user.enum';
import { DeleteFromSettingsDto, UpdateSettingsDto } from './dto/setting.dto';

@Controller('settings')
export class SettingController {
  constructor(private readonly storeService: SettingService) {}

  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Get('initialize')
  async initialize() {
    return await this.storeService.initialize();
  }

  @Public()
  @Get()
  async settings() {
    return await this.storeService.settings();
  }

  @Patch()
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  async updateSettings(@Body() payload: UpdateSettingsDto) {
    return await this.storeService.updateSettings(payload);
  }

  @Post('delete')
  @UseGuards(RoleGuard)
  @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  async deleteFromSettings(@Body() payload: DeleteFromSettingsDto) {
    return await this.storeService.deleteFromSettings(payload.keys);
  }
}
