import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  CredentialTypeEnum,
  CredentialCategoryEnum,
  CredentialStatusEnum,
} from 'src/common/enums/credential.enum';
import { User, UserDocument } from '../../user/schemas/user.schema';

export type CredentialDocument = Credential & Document;

@Schema({ timestamps: true })
export class Credential {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  user: UserDocument;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  issuer: UserDocument;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  subject: UserDocument;

  @Prop({ required: true })
  title: string;

  @Prop({ enum: CredentialTypeEnum, required: true })
  type: CredentialTypeEnum;

  @Prop({ enum: CredentialCategoryEnum, required: true })
  category: CredentialCategoryEnum;

  @Prop({ required: false })
  url: string;

  @Prop({ required: false })
  imageUrl?: string;


  @Prop({ required: false })
  ipfsHash?: string;


  @Prop({ required: false })
  evidenceHash?: string;

  @Prop({ required: false })
  description: string;

  @Prop({ default: true })
  visibility: boolean;

  @Prop({ enum: CredentialStatusEnum, default: CredentialStatusEnum.PENDING })
  verificationStatus: CredentialStatusEnum;

  @Prop({ default: false })
  isDeleted: boolean;

  // @Prop({ enum: CredentialStatusEnum, default: CredentialStatusEnum.PENDING })
  // verificationStatus: CredentialStatusEnum;

  // @Prop({ enum: VerificationLevelEnum, default: 'LOW' })
  // verificationLevel: VerificationLevelEnum;

  @Prop({ default: null })
  verifiedAt?: Date;

  @Prop({ default: null })
  rejectionReason: string;
}

export const CredentialSchema = SchemaFactory.createForClass(Credential);

CredentialSchema.pre(/^find/, function (next) {
  const preConditions = {
    isDeleted: false,
  };

  const postConditions = this['_conditions'];

  this['_conditions'] = { ...preConditions, ...postConditions };

  next();
});
