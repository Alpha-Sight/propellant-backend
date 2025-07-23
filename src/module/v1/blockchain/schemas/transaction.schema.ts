import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  TransactionStatusEnum,
  TransactionTypeEnum,
} from 'src/common/enums/transaction.enum';

export type BlockchainTransactionDocument = BlockchainTransaction & Document;

@Schema({ timestamps: true })
export class BlockchainTransaction {
  @Prop({ required: true, index: true, unique: true })
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

  @Prop({ required: true, enum: TransactionStatusEnum, default: TransactionStatusEnum.PENDING })
  status: TransactionStatusEnum;

  @Prop({ required: true, enum: TransactionTypeEnum })
  type: TransactionTypeEnum;

  @Prop({ default: 0 })
  attempts?: number;

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

  @Prop()
  updatedAt?: Date;
}

export const BlockchainTransactionSchema = SchemaFactory.createForClass(
  BlockchainTransaction,
);
