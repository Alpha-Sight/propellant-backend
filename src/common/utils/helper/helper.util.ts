import * as bcrypt from 'bcryptjs';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import * as fs from 'fs';
// import { customAlphabet, nanoid } from 'nanoid';
import { ENVIRONMENT } from '../../configs/environment';
import { Types, Document as MongooseDocument } from 'mongoose';
import { customAlphabet, nanoid } from 'nanoid';
import { logger } from '../logger';
import { WALLET_CONSTANT } from 'src/common/constants/walletConstant';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { MessageMediaTypeEnum } from 'src/common/enums/message.enum';
// import * as ffmpeg from 'fluent-ffmpeg';

// import { customAlphabet } from 'nanoid';

const encryptionKeyFromEnv = ENVIRONMENT.APP.ENCRYPTION_KEY;
interface MongooseResourceDocument {
  _id: Types.ObjectId;
  toObject?: () => any;
}
export class BaseHelper {
  static generateRandomString(length = 8) {
    return randomBytes(length).toString('hex');
  }

  static async hashData(data: string) {
    return await bcrypt.hash(data, 12);
  }

  static async compareHashedData(data: string, hashed: string) {
    return await bcrypt.compare(data, hashed);
  }

  static generateOTP(): number {
    return Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
  }

  static readonly isValidFileNamePinataUpload = (fileName: string) => {
    const regex =
      /^[a-zA-Z0-9_\-/]+\/[a-zA-Z0-9_-]+(?:-\d+)?\.(jpg|png|jpeg|webp)$/;
    return regex.test(fileName);
  };

  static encryptData(
    data: string,
    encryptionKey: string = encryptionKeyFromEnv,
  ): string {
    const iv = randomBytes(16); // Generate a 16-byte IV
    const cipher = createCipheriv(
      'aes-256-ctr',
      Buffer.from(encryptionKey),
      iv,
    );

    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    return iv.toString('hex') + ':' + encryptedData;
  }

  static decryptData(
    encryptedData: string,
    encryptionKey: string = encryptionKeyFromEnv,
  ): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = parts.join(':');
    const decipher = createDecipheriv(
      'aes-256-ctr',
      Buffer.from(encryptionKey),
      iv,
    );
    let decryptedData = decipher.update(encryptedText, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');
    return decryptedData;
  }

  /**
   * Generate 32 bytes (256 bits) of random data for AES-256 encryption
   *
   * @return {string} hexadecimal string representing the encryption key
   */
  static generateEncryptionKey(): string {
    const keyBytes = randomBytes(16);
    // Convert the random bytes to a hexadecimal string
    const encryptionKey = keyBytes.toString('hex');

    return encryptionKey;
  }

  static generateFileName(folder = 'uploads', mimetype = 'image/jpg') {
    const uniqueId = crypto.randomUUID();
    const fileExtension = mimetype.split('/')[1];
    const validExtensions = ['jpg', 'png', 'jpeg', 'webp'];

    if (!validExtensions.includes(fileExtension)) {
      throw new Error('Invalid file extension');
    }

    return `${folder}/${uniqueId}.${fileExtension}`;
  }

  // static generateUniqueIdentifier(): string {
  //   const prefix = `${ENVIRONMENT.APP.NAME?.toUpperCase()}-`;
  //   const randomChars = nanoid();

  //   return `${prefix}${randomChars}`;
  // }

  static deleteFile(path: string) {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  }

  static generateReferralCode(userId: string): string {
    // Generate a unique referral code for the user by combining the first 4 and last 3 digits of the user's ID
    const uniqueId =
      userId.toString().slice(0, 4) + userId.toString().slice(-3);
    const randomChars = nanoid(6);
    // const randomChars = 123;

    return `${uniqueId}${randomChars}`;
  }

  static parseStringToObject(string: string) {
    return string && typeof string === 'string' ? JSON.parse(string) : string;
  }

  static camelCaseToSpacedWords(input: string): string {
    return input.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }

  static changeToCurrency(value: number): string {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }

  static generateReferenceCode(refPrefix?: string): string {
    const REF_NUMBER_LENGTH = 8;
    const REF_PREFIX = refPrefix || 'REF';
    const REF_ALPHABET = '0123456789';

    const date = new Date();
    const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');

    const numberGen = customAlphabet(REF_ALPHABET, REF_NUMBER_LENGTH);
    const uniqueNumber = numberGen();

    return `${REF_PREFIX}-${datePart}-${uniqueNumber}`;
  }

  static getMongoDbResourceId<T = string>(
    resource:
      | MongooseDocument
      | MongooseResourceDocument
      | Types.ObjectId
      | string
      | null,
  ): string | null | T {
    if (!resource) return null;

    try {
      // Handle Mongoose Document with _id
      if (
        (resource instanceof MongooseDocument ||
          (typeof resource === 'object' &&
            resource !== null &&
            'toObject' in resource)) &&
        '_id' in resource
      ) {
        return resource._id.toString();
      }

      // Handle ObjectId
      if (resource instanceof Types.ObjectId) {
        return resource.toString();
      }

      // Handle string - validate if it's a valid ObjectId
      if (typeof resource === 'string') {
        return Types.ObjectId.isValid(resource) ? resource : null;
      }

      // Handle plain object with _id
      if (typeof resource === 'object' && '_id' in resource) {
        const id = resource._id;
        if (id instanceof Types.ObjectId) {
          return id.toString();
        }
        if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
          return id;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting MongoDB resource ID:', error);
      return null;
    }
  }

  static generateUuid = () => {
    return uuidv4();
  };

  static createSignatureMessage = (
    walletAddress: string,
    nonce: string,
  ): string => {
    return `${WALLET_CONSTANT.walletMessagePrefix}\nWallet: ${walletAddress}\nNonce: ${nonce}`;
  };

  static verifyWalletSignature = (
    message: string,
    signature: string,
    walletAddress: string,
  ): boolean => {
    try {
      // Verify the signature using ethers.js
      const recoveredAddress = ethers.verifyMessage(message, signature);
      console.log('recoveredAddress', recoveredAddress);

      // Compare the recovered address with the provided wallet address (case-insensitive)
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch (error: unknown) {
      logger.error('Error verifying wallet signature', error, {
        walletAddress,
      });
      return false;
    }
  };

  static generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      walletAddress: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      mnemonic: wallet.mnemonic?.phrase || '',
    };
  }

  static getFileTypeFromMimeType(mimeType: string) {
    let type = MessageMediaTypeEnum.IMAGE;

    switch (mimeType) {
      case 'image/png':
      case 'image/jpg':
      case 'image/jpeg':
        type = MessageMediaTypeEnum.IMAGE;
        break;
      case 'video/mp4':
        type = MessageMediaTypeEnum.VIDEO;
        break;
      case 'audio/mp3':
      case 'audio/mpeg':
        type = MessageMediaTypeEnum.AUDIO;
        break;
      default:
        type = MessageMediaTypeEnum.IMAGE;
        break;
    }

    return type;
  }

  // static calculateAudioDuration(file: Express.Multer.File) {
  //   return new Promise<string>((resolve, reject) => {
  //     // Create a readable stream from the file buffer
  //     ffmpeg()
  //       .input(Readable.from(file.buffer))
  //       .inputFormat(file.mimetype.split('/')[1])
  //       .ffprobe((err, metadata) => {
  //         if (err) return reject(err);

  //         // Get the bit rate from the metadata,
  //         const bitRate = metadata.format.bit_rate;
  //         const fileSize = file.buffer.length;

  //         // Calculate duration in seconds: (file size in bits) / (bits per second)
  //         if (bitRate && fileSize) {
  //           const durationInSeconds = Math.round((fileSize * 8) / bitRate);
  //           const minutes = Math.floor(durationInSeconds / 60);
  //           const seconds = durationInSeconds % 60;
  //           resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
  //         } else {
  //           resolve('0:00');
  //         }
  //       });
  //   });
  // }
}
