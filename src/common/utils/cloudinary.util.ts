// import { v2 } from 'cloudinary';
// import * as dotenv from 'dotenv';
// import { ENVIRONMENT } from 'src/common/configs/environment';

// import { Injectable, BadRequestException } from '@nestjs/common';
// import { v2 as cloudinary, DeleteApiResponse } from 'cloudinary';
// import { UploadApiResponse } from 'cloudinary';
// import * as streamifier from 'streamifier';
// dotenv.config();
// const CLOUDINARY = 'Cloudinary';
// export const CloudinaryProvider = {
//   provide: CLOUDINARY,
//   useFactory: () => {
//     return v2.config({
//       cloud_name: ENVIRONMENT.CLOUDINARY.CLOUDINARY_NAME,
//       api_key: ENVIRONMENT.CLOUDINARY.CLOUDINARY_API_KEY,
//       api_secret: ENVIRONMENT.CLOUDINARY.CLOUDINARY_API_SECRET,
//     });
//   },
// };

// @Injectable()
// export class CloudinaryService {
//   async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
//     if (!file || !file.buffer) {
//       throw new BadRequestException('Invalid file: Buffer is missing');
//     }

//     return new Promise((resolve, reject) => {
//       const uploadStream = cloudinary.uploader.upload_stream(
//         { folder: 'Agric ProConnect Photos' },
//         (error, result) => {
//           if (error) return reject(error);
//           resolve(result);
//         },
//       );

//       streamifier.createReadStream(file.buffer).pipe(uploadStream);
//     });
//   }

//   async deleteFile(fileUrl: string): Promise<DeleteApiResponse> {
//     if (!fileUrl) {
//       throw new BadRequestException('File URL is required for deletion');
//     }

//     try {
//       const publicId = this.extractPublicIdFromUrl(fileUrl);

//       return await cloudinary.uploader.destroy(publicId, {
//         invalidate: true,
//       });
//     } catch (error) {
//       throw new Error(`Failed to delete file: ${error.message}`);
//     }
//   }

//   private extractPublicIdFromUrl(url: string): string {
//     try {
//       const urlParts = url.split('/');

//       const versionIndex = urlParts.findIndex(
//         (part) => part.startsWith('v') && /^v\d+$/.test(part),
//       );

//       if (versionIndex !== -1 && versionIndex < urlParts.length - 1) {
//         return urlParts
//           .slice(versionIndex + 1)
//           .join('/')
//           .replace(/\.\w+$/, '');
//       }

//       throw new Error('Invalid Cloudinary URL format');
//     } catch (error) {
//       throw new BadRequestException(
//         `Failed to extract public ID: ${error.message}`,
//       );
//     }
//   }
// }
