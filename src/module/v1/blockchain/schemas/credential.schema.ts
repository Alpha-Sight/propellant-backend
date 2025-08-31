import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CredentialDocument = Credential & Document;

@Schema({ timestamps: true })
export class Credential {
  @Prop({ required: true, unique: true })
  credentialId: string;

  @Prop({ type: Number })
  blockchainCredentialId?: number;

  @Prop({ required: true })
  subject: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  issuer: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  metadataURI?: string;

  @Prop({ required: true })
  credentialType: number;

  @Prop()
  validUntil?: number;

  @Prop({ required: true })
  evidenceHash: string;

  @Prop({ required: true })
  revocable: boolean;

  @Prop({ required: true })
  status: string;

  @Prop({ default: 'PENDING' })
  verificationStatus?: string;

  @Prop()
  transactionId?: string;

  @Prop()
  transactionHash?: string;
  
  @Prop({ index: true })
  blockchainTransactionHash?: string;

  @Prop()
  blockNumber?: number;

  @Prop()
  tokenId?: string;

  @Prop()
  error?: string;
  
  @Prop()
  lastError?: string;

  @Prop()
  verificationRequestedAt?: Date;
  
  @Prop()
  lastVerifiedAt?: Date;
  
  @Prop()
  mintingStartedAt?: Date;
  
  @Prop()
  mintedAt?: Date;

  @Prop()
  rejectionReason?: string;

  @Prop()
  blockchainTransactionId?: string;
  
  @Prop()
  blockchainVerificationTransactionId?: string;

  @Prop()
  blockchainStatus?: string;
  
  @Prop()
  blockchainError?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const CredentialSchema = SchemaFactory.createForClass(Credential);

// Create indexes for better performance
CredentialSchema.index({ subject: 1, status: 1 });
CredentialSchema.index({ blockchainCredentialId: 1 });
CredentialSchema.index({ issuer: 1 });

