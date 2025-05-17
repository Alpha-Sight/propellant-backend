import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { OtpTypeEnum } from '../../../../common/enums/otp.enum';

export type OTPDocument = OTP & Document;

// expires in 10 minutes
@Schema({ expires: 600 })
export class OTP {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true, enum: OtpTypeEnum })
  type: OtpTypeEnum;

  @Prop({ default: new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date(Date.now() + 600 * 1000), expires: 600 })
  expiresAt: Date;
}

export const OTPSchema = SchemaFactory.createForClass(OTP);
