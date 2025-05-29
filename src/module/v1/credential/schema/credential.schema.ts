import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  CredentialTypeEnum,
  CredentialStatusEnum,
  VerificationLevelEnum,
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

  @Prop({ enum: CredentialTypeEnum, required: true })
  type: CredentialTypeEnum;

  @Prop({ required: true })
  issuer: string;

  @Prop({ required: false })
  ipfsHash?: string;

  @Prop({ enum: CredentialStatusEnum, default: CredentialStatusEnum.PENDING })
  verificationStatus: CredentialStatusEnum;

  @Prop({ enum: VerificationLevelEnum, default: 'LOW' })
  verificationLevel: VerificationLevelEnum;

  @Prop({ default: null })
  verifiedAt?: Date;

  @Prop({ default: true })
  visibility: boolean;

  @Prop({ default: null })
  rejectionReason: string;

  @Prop({ default: false })
  isDeleted: boolean;
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
