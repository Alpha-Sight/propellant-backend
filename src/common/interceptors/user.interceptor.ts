// import {
//   Injectable,
//   NestInterceptor,
//   ExecutionContext,
//   CallHandler,
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { Observable, map } from 'rxjs';

// @Injectable()
// export class RoleBasedFieldInterceptor<T> implements NestInterceptor<T, any> {
//   constructor(private reflector: Reflector) {}

//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     const request = context.switchToHttp().getRequest();

//     // Check for role in authenticated user or in payload
//     const userFromAuth = request.user;
//     const roleFromPayload = request.body?.role;

//     const role = userFromAuth?.role || roleFromPayload || 'UNKNOWN';

//     console.log('[Interceptor] Authenticated user:', userFromAuth);
//     console.log('[Interceptor] Role from payload:', roleFromPayload);
//     console.log('[Interceptor] Final resolved role:', role);

//     return next.handle().pipe(
//       map((data) => {
//         if (data?.user) {
//           console.log('[Interceptor] Original user:', data.user);

//           const roleFieldMap = {
//             TALENT: [
//               'skills',
//               'referralCode',
//               'totalReferrals',
//               'socials',
//               'profilePhoto',
//               'visibility',
//               'email',
//               'phone',
//               'role',
//               'authSource',
//               'profileCompleted',
//               'emailVerified',
//               'termsAndConditionsAccepted',
//               'lastLoginAt',
//               '_id',
//               'createdAt',
//               'updatedAt',
//               'isDeleted',
//               'walletAddress',
//             ],
//             ORGANIZATION: [
//               'totalJobPost',
//               'talentContacted',
//               'activePost',
//               'activeConversations',
//               'responseRate',
//               'successfulHire',
//               'visibility',
//               'email',
//               'phone',
//               'role',
//               'authSource',
//               'profileCompleted',
//               'emailVerified',
//               'termsAndConditionsAccepted',
//               'lastLoginAt',
//               '_id',
//               'createdAt',
//               'updatedAt',
//               'isDeleted',
//               'walletAddress',
//             ],
//           };

//           const allowedFields = roleFieldMap[role] || [];

//           const filteredUser = {};
//           for (const key of allowedFields) {
//             if (key in data.user) filteredUser[key] = data.user[key];
//           }

//           console.log('[Interceptor] data.user keys:', Object.keys(data.user));
//           console.log('[Interceptor] Filtered user:', filteredUser);

//           data.user = filteredUser;
//         }

//         return data;
//       }),
//     );
//   }
// }
