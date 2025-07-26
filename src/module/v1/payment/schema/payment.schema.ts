import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  imageUrl: string;

  @Prop()
  fee: number;

  @Prop({ default: true })
  active: boolean;

  @Prop({ select: false })
  apiKey: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.pre('find', function (next) {
  this.where({ isDeleted: false });

  next();
});
