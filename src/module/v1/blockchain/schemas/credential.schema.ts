import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CredentialDocument = Credential & Document;

@Schema({ timestamps: true })
export class Credential {
  @Prop({ required: true, unique: true, index: true })
  credentialId: string;

  @Prop({ required: true, index: true })
  subject: string;

  @Prop({ required: true, index: true })
  issuer: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  metadataURI?: string;

  @Prop({ required: true })
  credentialType: number;

  @Prop({ required: true })
  validUntil: number;

  @Prop()
  evidenceHash?: string;

  @Prop({ required: true })
  revocable: boolean;

  @Prop({ required: true, enum: ['PENDING', 'ISSUED', 'VERIFIED', 'REVOKED', 'FAILED'] })
  status: string;

  @Prop()
  transactionId?: string;

  @Prop()
  transactionHash?: string;

  @Prop()
  blockNumber?: number;

  @Prop()
  tokenId?: string;

  @Prop()
  error?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const CredentialSchema = SchemaFactory.createForClass(Credential);