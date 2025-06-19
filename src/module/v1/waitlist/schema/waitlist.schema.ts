import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WaitlistInterestEnum } from 'src/common/enums/waitlist.enum';
@Schema({
  timestamps: true,
})
export class Waitlist extends Document {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  institution: string;

  @Prop()
  skills: string;

  @Prop({
    type: [String],
    enum: WaitlistInterestEnum,
    default: [],
  })
  interest: WaitlistInterestEnum[];

  @Prop({ default: false })
  isDeleted: boolean;
}

export const WaitlistSchema = SchemaFactory.createForClass(Waitlist);
