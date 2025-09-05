import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import {
  TransactionStatusEnum,
  TransactionTypeEnum,
} from '../../../../common/enums/transaction.enum';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  user: UserDocument;

  @Prop({ unique: true, required: true })
  reference: string;

  @Prop({ enum: TransactionTypeEnum, required: true })
  type: TransactionTypeEnum;

  @Prop({ required: true })
  plan: string;

  @Prop()
  description: string;

  @Prop({ default: 0, select: false })
  settlement: number;

  @Prop()
  totalAmount: number;

  @Prop()
  paymentMethod: string;

  @Prop({ enum: TransactionStatusEnum, default: TransactionStatusEnum.PENDING })
  status: TransactionStatusEnum;

  @Prop({ type: Object, default: {}, select: false })
  metadata: any;

  @Prop()
  errorMessage: string;

  @Prop()
  approvedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// TransactionSchema.pre('validate', function (next) {
//   this.reference = BaseHelper.generateRandomString();
//   next();
// });

TransactionSchema.pre(['find', 'findOne'], function (next) {
  this.populate('user paymentMethod');
  next();
});

TransactionSchema.pre('findOne', function (next) {
  this.populate('user paymentMethod');
  next();
});
