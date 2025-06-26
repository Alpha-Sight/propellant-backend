import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true, unique: true, index: true })
  transactionId: string;

  @Prop({ required: true, index: true })
  userAddress: string;

  @Prop({ required: true, index: true })
  accountAddress: string;

  @Prop({ required: true })
  target: string;

  @Prop({ required: true, default: '0' })
  value: string;

  @Prop({ required: true })
  data: string;

  @Prop({ required: true, default: 0 })
  operation: number;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' })
  status: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop()
  transactionHash?: string;

  @Prop()
  blockNumber?: number;

  @Prop()
  gasUsed?: string;

  @Prop()
  lastError?: string;

  @Prop()
  processedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);