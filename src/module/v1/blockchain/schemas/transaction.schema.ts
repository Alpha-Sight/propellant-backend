import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema()
export class Transaction {
  @Prop({ required: true, index: true })
  transactionId: string;

  @Prop({ required: true })
  userAddress: string;

  @Prop({ required: true })
  accountAddress: string;

  @Prop({ required: true })
  target: string;

  @Prop({ required: true })
  value: string;

  @Prop({ required: true })
  data: string;

  @Prop({ required: true })
  operation: number;

  @Prop({ required: true, enum: ['PENDING', 'SUCCESS', 'FAILED'] })
  status: string;

  @Prop()
  transactionHash?: string;

  @Prop()
  blockNumber?: number;

  @Prop()
  gasUsed?: string;

  @Prop()
  error?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);