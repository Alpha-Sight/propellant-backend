import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  TransactionStatusEnum,
  TransactionTypeEnum,
} from 'src/common/enums/transaction.enum';

export type BlockchainTransactionDocument = BlockchainTransaction & Document;

@Schema()
export class BlockchainTransaction {
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

  @Prop({ required: true, enum: TransactionStatusEnum })
  status: TransactionStatusEnum;

  @Prop({ required: true, enum: TransactionTypeEnum })
  type: TransactionTypeEnum;

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

export const BlockchainTransactionSchema = SchemaFactory.createForClass(
  BlockchainTransaction,
);
