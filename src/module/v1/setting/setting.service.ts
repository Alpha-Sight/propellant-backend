import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ISettings,
  ISubscriptionPlan,
} from '../../../common/interfaces/setting.interface';
import { CacheHelperUtil } from '../../../common/utils/cache-helper.util';
import { SETTINGS } from '../../../common/constants/setting.constant';
import { CACHE_KEYS } from 'src/common/constants/cache.constant';
import { UpdateSettingsDto } from './dto/setting.dto';
import { UserDocument } from '../user/schemas/user.schema';

@Injectable()
export class SettingService implements OnModuleInit {
  async onModuleInit() {
    const settingsExist = await CacheHelperUtil.getCache(
      CACHE_KEYS.appSettings,
    );

    if (!settingsExist) {
      await CacheHelperUtil.setCache(CACHE_KEYS.appSettings, SETTINGS);
    }
  }

  async initialize() {
    await CacheHelperUtil.setCache(CACHE_KEYS.appSettings, SETTINGS);
  }

  async settings() {
    return await CacheHelperUtil.getCache(CACHE_KEYS.appSettings);
  }

  async getSettings() {
    const getSettings = await CacheHelperUtil.getCache(CACHE_KEYS.appSettings);
    return getSettings;
  }

  async updateSettings(payload: UpdateSettingsDto) {
    const prevSettings = (await CacheHelperUtil.getCache(
      CACHE_KEYS.appSettings,
    )) as ISettings;
    const updatedSettings = { ...prevSettings, ...payload };
    await CacheHelperUtil.setCache(CACHE_KEYS.appSettings, updatedSettings);
    return updatedSettings;
  }

  async deleteFromSettings(query: string[]) {
    const prevSettings = (await CacheHelperUtil.getCache(
      CACHE_KEYS.appSettings,
    )) as ISettings;
    const updatedSettings = { ...prevSettings };
    query.forEach((prop: string) => delete updatedSettings[prop]);
    await CacheHelperUtil.setCache(CACHE_KEYS.appSettings, updatedSettings);
    return updatedSettings;
  }

  async getSubscriptionPrice(user: UserDocument) {
    const settings = (await CacheHelperUtil.getCache(
      CACHE_KEYS.appSettings,
    )) as any;

    const subscriptionPlans = (settings?.app?.subscriptionPlans || []).map(
      (plan: ISubscriptionPlan) => ({
        ...plan,
        isCurrentPlan: plan.name === user.plan,
      }),
    );

    return subscriptionPlans;
  }
}
