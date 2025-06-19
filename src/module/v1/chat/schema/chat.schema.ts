import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { Message, MessageDocument } from './message.schema';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }] })
  participants: UserDocument[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Message.name })
  lastMessage: MessageDocument;

  @Prop({ default: 0, min: 0 })
  unreadMessageCount: number;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

ChatSchema.pre('find', async function (next) {
  this.populate('participants lastMessage');

  next();
});
