import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  AuthSourceEnum,
  UserRoleEnum,
} from '../../../../common/enums/user.enum';
import { PlanTypeEnum } from 'src/common/enums/premium.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, index: true })
  email: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ select: false })
  password: string;

  @Prop({ required: false, default: null })
  profilePhoto: string;

  @Prop({ required: false, default: null, trim: true, index: true })
  fullname: string;

  @Prop({ default: '' })
  bio: string;

  @Prop({ required: false })
  phone: string;

  @Prop({ required: false, sparse: true, unique: true, index: true })
  walletAddress: string;

  @Prop({ enum: UserRoleEnum })
  role: UserRoleEnum;

  @Prop({ default: AuthSourceEnum.EMAIL, enum: AuthSourceEnum })
  authSource: AuthSourceEnum;

  @Prop({ default: '' })
  linkedin: string;

  @Prop({ default: '' })
  github: string;

  @Prop({ default: '' })
  twitter: string;

  @Prop({ default: '' })
  instagram: string;

  @Prop({ default: null, index: true })
  referralCode: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  referredBy: UserDocument;

  @Prop({ default: 0 })
  totalReferrals: number;

  @Prop({ enum: PlanTypeEnum })
  plan: PlanTypeEnum;

  @Prop({ default: false })
  profileCompleted?: boolean;

  @Prop({ default: null })
  lastLoginAt: Date;

  @Prop({ default: false })
  isNewUser: boolean;

  @Prop({ default: false })
  termsAndConditionsAccepted: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre(/^find/, function (next) {
  const preConditions = {
    isDeleted: false,
  };

  const postConditions = this['_conditions'];

  this['_conditions'] = { ...preConditions, ...postConditions };

  next();
});

// UserSchema.pre('validate', async function (next) {
//   if (!this.referralCode) {
//     this.referralCode = BaseHelper.generateReferenceCode();
//   }

//   next();
// });
