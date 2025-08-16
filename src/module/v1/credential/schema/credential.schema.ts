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

  @Prop({ default: null })
  verifiedAt?: Date;

  @Prop({ default: null })
  rejectionReason: string;

  // Enhanced fields for organization verification
  @Prop({ required: false })
  issuingOrganization?: string;

  @Prop({ required: false })
  verifyingOrganization?: string;

  @Prop({ required: false })
  verifyingEmail?: string;

  @Prop({ required: false })
  message?: string;

  @Prop({ required: false })
  issueDate?: Date;

  @Prop({ required: false })
  expiryDate?: Date;

  @Prop({ required: false })
  externalUrl?: string;

  // Verification tracking fields
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  verifiedBy?: UserDocument;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  rejectedBy?: UserDocument;

  @Prop({ required: false })
  rejectedAt?: Date;

  @Prop({ required: false })
  verificationNotes?: string;

  @Prop({
    required: false,
    enum: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'APPEALED'],
    default: 'PENDING_VERIFICATION',
  })
  attestationStatus?: string;

  @Prop({ required: false })
  verificationRequestSentAt?: Date;

  @Prop({ required: false })
  verificationDeadline?: Date;

  // Blockchain integration fields
  @Prop({ required: false })
  blockchainCredentialId?: string;

  @Prop({ required: false })
  blockchainTransactionId?: string;

  @Prop({
    required: false,
    enum: ['NOT_MINTED', 'PENDING_BLOCKCHAIN', 'MINTED', 'MINTING_FAILED'],
    default: 'NOT_MINTED',
  })
  blockchainStatus?: string;

  @Prop({ required: false })
  blockchainError?: string;

  @Prop({ required: false })
  lastMintAttempt?: Date;

  @Prop({ required: false })
  mintedAt?: Date;

  // Backward compatibility fields
  @Prop({ required: false })
  credentialId?: string;

  @Prop({ required: false })
  name?: string;

  @Prop({ required: false })
  credentialType?: number;

  @Prop({ required: false })
  revocable?: boolean;

  @Prop({ required: false })
  status?: string;

  @Prop({ required: false })
  createdAt?: Date;
}

export const TalentCredentialSchema =
  SchemaFactory.createForClass(TalentCredential);

// Add indexes for efficient queries
TalentCredentialSchema.index({ verifyingEmail: 1, verificationStatus: 1 });
TalentCredentialSchema.index({
  verifyingOrganization: 1,
  attestationStatus: 1,
});
TalentCredentialSchema.index({ user: 1, verificationStatus: 1 });

TalentCredentialSchema.pre(/^find/, function (next) {
  const preConditions = {
    isDeleted: false,
  };

  const postConditions = this['_conditions'];
  this['_conditions'] = { ...preConditions, ...postConditions };
  next();
});
