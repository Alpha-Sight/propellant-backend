import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  AuthSourceEnum,
  UserRoleEnum,
  UserVisibilityEnum,
} from '../../../../common/enums/user.enum';
import { SubscriptionTypeEnum } from 'src/common/enums/premium.enum';
import { OrganizationSocialDto } from '../dto/user.dto';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  // Talent profile properties
  @Prop({ required: false, trim: true, index: true })
  fullname: string;

  @Prop({ required: false })
  bio: string;

  @Prop({ required: false })
  linkedin?: string;

  @Prop({ required: false })
  github?: string;

  @Prop({ required: false })
  twitter?: string;

  @Prop({ required: false })
  instagram?: string;

  @Prop({ required: false, type: [String], default: undefined })
  skills?: string[];

  @Prop({ index: true })
  referralCode: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  referredBy: UserDocument;

  @Prop()
  totalReferrals: number;

  // organization profile properties
  @Prop({ required: false })
  companyName?: string;

  @Prop({ required: false })
  tagline?: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: false })
  industry?: string;

  @Prop({ required: false })
  companySize?: string;

  @Prop({ required: false, type: [String], default: undefined })
  offers?: string[];

  @Prop({ required: false, type: [OrganizationSocialDto], default: undefined })
  socials?: OrganizationSocialDto[];

  @Prop()
  totalJobPost: number;

  @Prop()
  talentContacted: number;

  @Prop()
  activePost: number;

  @Prop()
  activeConversations: number;

  @Prop()
  responseRate: number;

  @Prop()
  successfulHire: number;

  @Prop({
    type: String,
    enum: UserVisibilityEnum,
    default: UserVisibilityEnum.PUBLIC,
  })
  visibility: UserVisibilityEnum;

  // general profile properties
  @Prop({ unique: true, index: true })
  email: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ select: false })
  password: string;

  @Prop({ required: false, default: '' })
  profilePhoto: string;

  @Prop({ required: false })
  phone: string;

  @Prop({ required: false, sparse: true, unique: true, index: true })
  walletAddress: string;

  @Prop({ enum: UserRoleEnum })
  role: UserRoleEnum;

  @Prop({ default: AuthSourceEnum.EMAIL, enum: AuthSourceEnum })
  authSource: AuthSourceEnum;

  @Prop({ required: false })
  location?: string;

  @Prop({ enum: SubscriptionTypeEnum, default: SubscriptionTypeEnum.FREE })
  plan: SubscriptionTypeEnum;

  @Prop({ required: false })
  totalCredentialUploads: number;

  @Prop({ required: false })
  totalCvDownload: number;

  @Prop({ default: false })
  profileCompleted?: boolean;

  @Prop({ default: null })
  lastLoginAt: Date;

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

// UserSchema.set('toObject', {
//   transform: (_, ret) => {
//     if (ret.role === 'TALENT') {
//       delete ret.totalJobPost;
//     }
//     if (ret.role === 'ORGANIZATION') {
//       delete ret.totalReferrals;
//     }
//     return ret;
//   },
// });

// UserSchema.set('toJSON', {
//   transform: (_, ret) => {
//     if (ret.role === 'TALENT') {
//       delete ret.totalJobPost;
//     }
//     if (ret.role === 'ORGANIZATION') {
//       delete ret.totalReferrals;
//     }
//     return ret;
//   },
// });

// UserSchema.pre('validate', async function (next) {
//   if (!this.referralCode) {
//     this.referralCode = BaseHelper.generateReferenceCode();
//   }

//   next();
// });
