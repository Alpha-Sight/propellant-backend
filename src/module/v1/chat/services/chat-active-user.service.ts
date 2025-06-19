// import { Injectable } from '@nestjs/common';
// import { CACHE_KEYS } from 'src/common/constants/cache.constant';
// import { CacheHelperUtil } from 'src/common/utils/cache-helper.util';

// @Injectable()
// export class ActiveUserService {
//   async getActiveUser(userId: string) {
//     const user = await CacheHelperUtil.getCache(CACHE_KEYS.ACTIVE_USERS);
//     return user[userId];
//   }

//   async updateActiveUser(userId: string, socketId: string, isActive: boolean) {
//     const user =
//       (await CacheHelperUtil.getCache(CACHE_KEYS.ACTIVE_USERS)) || {};

//     // If the user doesn't exist in the cache, create a new one, otherwise update the user
//     user[userId] = {
//       userId,
//       socketId,
//       isActive,
//     };

//     return CacheHelperUtil.setCache(CACHE_KEYS.ACTIVE_USERS, user);
//   }

//   async removeActiveUser(userId: string) {
//     const user = await CacheHelperUtil.getCache(CACHE_KEYS.ACTIVE_USERS);
//     if (!user) return;
//     delete user[userId];
//     return CacheHelperUtil.setCache(CACHE_KEYS.ACTIVE_USERS, user);
//   }
// }
