import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletDocument = Wallet & Document;

@Schema({ timestamps: true })
export class Wallet {
  @Prop({ required: true, unique: true, index: true })
  userAddress: string;

  @Prop({ required: true, unique: true, index: true })
  walletAddress: string;

  @Prop({ required: true, unique: true, index: true })
  accountAddress: string;

  @Prop({ required: true })
  salt: number;

  @Prop({ required: true, enum: ['PENDING', 'CREATED', 'FAILED'] })
  status: string;

  @Prop()
  transactionId?: string;

  @Prop()
  transactionHash?: string;

  @Prop()
  blockNumber?: number;

  @Prop()
  error?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);