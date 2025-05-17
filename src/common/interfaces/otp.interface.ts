import { UserDocument } from '../../module/v1/user/schemas/user.schema';
import { OtpTypeEnum } from '../enums/otp.enum';

export interface IRequestOtp {
  email: string;
  phone: string;
  type: OtpTypeEnum;
  code?: number;
  user?: UserDocument;
}
