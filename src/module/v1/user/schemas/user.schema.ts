import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  AuthSourceEnum,
  UserRoleEnum,
} from '../../../../common/enums/user.enum';

export type UserDocument = User & Document;

@Schema()
export class Socials {
  @Prop({ default: '' })
  twitter: string;

  @Prop({ default: '' })
  linkedin: string;

  @Prop({ default: '' })
  github: string;

  @Prop({ default: '' })
  instagram: string;
}

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
  firstName: string;

  @Prop({ required: false, default: null, index: true })
  lastName: string;

  @Prop({ default: null, index: true })
  username: string;

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
  location: string;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({})
  socials: Socials;

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
