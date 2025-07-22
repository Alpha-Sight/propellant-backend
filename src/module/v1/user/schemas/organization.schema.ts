import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  AuthSourceEnum,
  UserRoleEnum,
} from '../../../../common/enums/user.enum';
import { PlanTypeEnum } from 'src/common/enums/premium.enum';
import { OrganizationSocialDto } from '../dto/user.dto';
import { OrganizationVisibilityEnum } from 'src/common/enums/organization.enum';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true })
export class Organization {
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

  @Prop({ enum: UserRoleEnum })
  role: UserRoleEnum;

  @Prop({ default: AuthSourceEnum.EMAIL, enum: AuthSourceEnum })
  authSource: AuthSourceEnum;

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

  @Prop({ required: false, type: [String] })
  offers?: string[];

  @Prop({ required: false, type: [OrganizationSocialDto] })
  socials?: OrganizationSocialDto[];

  @Prop({ required: false, sparse: true, unique: true, index: true })
  walletAddress: string;

  @Prop({ default: 0 })
  totalJobPost: number;

  @Prop({ default: 0 })
  talentContacted: number;

  @Prop({ default: 0 })
  responseRate: number;

  @Prop({ default: 0 })
  successfulHire: number;

  @Prop({
    type: String,
    enum: OrganizationVisibilityEnum,
    default: OrganizationVisibilityEnum.PUBLIC,
  })
  visibility: OrganizationVisibilityEnum;

  @Prop({ enum: PlanTypeEnum })
  plan: PlanTypeEnum;

  //   @Prop({ default: false })
  //   profileCompleted?: boolean;

  //   @Prop({ default: null, index: true })
  //   referralCode: string;

  @Prop({ default: null })
  lastLoginAt: Date;

  @Prop({ default: false })
  isNewUser: boolean;

  @Prop({ default: false })
  termsAndConditionsAccepted: boolean;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.pre(/^find/, function (next) {
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
