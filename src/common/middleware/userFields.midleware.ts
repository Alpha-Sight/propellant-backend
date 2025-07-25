// import { Injectable, NestMiddleware } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';
// import { UserRoleEnum } from 'src/common/enums/user.enum';

// @Injectable()
// export class FilterUserFieldsMiddleware implements NestMiddleware {
//   use(req: Request, res: Response, next: NextFunction) {
//     const { role } = req.body;

//     // Log role if present
//     if (role) {
//       console.log(`[Middleware] Role detected: ${role}`);
//     }

//     // Check if role is valid
//     const validRoles = Object.values(UserRoleEnum);
//     if (!role || !validRoles.includes(role)) {
//       console.log(`[Middleware] Role not found or invalid. Skipping filtering.`);
//       return next();
//     }

//     // Define allowed general fields
//     const generalFields = [
//       'email',
//       'emailVerified',
//       'password',
//       'profilePhoto',
//       'phone',
//       'walletAddress',
//       'role',
//       'authSource',
//       'location',
//       'plan',
//       'profileCompleted',
//       'lastLoginAt',
//       'termsAndConditionsAccepted',
//       'isDeleted',
//       'createdAt',
//       'updatedAt',
//     ];

//     // Define role-specific fields
//     const roleSpecificFields: Record<UserRoleEnum, string[]> = {
//       [UserRoleEnum.TALENT]: [
//         'fullname',
//         'bio',
//         'linkedin',
//         'github',
//         'twitter',
//         'instagram',
//         'skills',
//         'referralCode',
//         'referredBy',
//         'totalReferrals',
//       ],
//       [UserRoleEnum.ORGANIZATION]: [
//         'companyName',
//         'tagline',
//         'description',
//         'industry',
//         'companySize',
//         'offers',
//         'socials',
//         'totalJobPost',
//         'talentContacted',
//         'activePost',
//         'activeConversations',
//         'responseRate',
//         'successfulHire',
//         'visibility',
//       ],
//       [UserRoleEnum.ADMIN]: [],
//       [UserRoleEnum.SUPER_ADMIN]: [],
//       [UserRoleEnum.FREELANCER]: [],
//     };

//     // Combine general + role-specific fields
//     const allowedFields = new Set([
//       ...generalFields,
//       ...(roleSpecificFields[role] || []),
//     ]);

//     // Filter req.body to include only allowed fields
//     req.body = Object.fromEntries(
//       Object.entries(req.body).filter(([key]) => allowedFields.has(key)),
//     );

//     console.log('[Middleware] Filtered req.body:', req.body);
//     next();
//   }
// }
