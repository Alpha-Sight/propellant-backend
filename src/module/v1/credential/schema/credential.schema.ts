import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  CredentialTypeEnum,
  CredentialCategoryEnum,
  CredentialStatusEnum,
} from 'src/common/enums/credential.enum';
import { User, UserDocument } from '../../user/schemas/user.schema';

export type TalentCredentialDocument = TalentCredential & Document;

@Schema({ timestamps: true })
export class TalentCredential {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  user: UserDocument;

  // Remove old issuer field, add new organization fields
  @Prop({ required: false })
  issuingOrganization?: string;

  @Prop({ required: false })
  verifyingOrganization?: string;

  @Prop({ required: false })
  verifyingEmail?: string;

  @Prop({ required: false })
  message?: string;

  @Prop({ required: false })
  issueDate?: string;

  @Prop({ required: false })
  expiryDate?: string;

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
  externalUrl: string;

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

  @Prop({ default: null })
  reviewedAt?: Date;

  @Prop({ default: null })
  rejectionReason: string;

  // Timestamp fields (automatically managed by Mongoose)
  createdAt?: Date;
  updatedAt?: Date;

  // Backward compatibility fields for blockchain schema
  credentialId?: string;
  credentialType?: number;
  revocable?: boolean;
  name?: string;
  issuer?: mongoose.Schema.Types.ObjectId;
  status?: string;
}

export const TalentCredentialSchema =
  SchemaFactory.createForClass(TalentCredential);

TalentCredentialSchema.pre(/^find/, function (next) {
  const preConditions = {
    isDeleted: false,
  };

  const postConditions = this['_conditions'];

  this['_conditions'] = { ...preConditions, ...postConditions };

  next();
});
