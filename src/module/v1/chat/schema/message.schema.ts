import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { ChatDocument } from './chat.schema';
import {
  MessageMediaTypeEnum,
  MessageStatus,
} from 'src/common/enums/message.enum';
import { ReactionEnum } from 'src/common/enums/reaction.enum';

@Schema({ timestamps: false })
export class MessageMedia {
  @Prop()
  url: string;

  @Prop({ enum: MessageMediaTypeEnum, default: MessageMediaTypeEnum.IMAGE })
  type: MessageMediaTypeEnum;
}

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  sender: UserDocument;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' })
  chat: ChatDocument;

  @Prop()
  content: string;

  @Prop({ type: String, enum: ReactionEnum })
  reaction?: ReactionEnum;

  @Prop({ default: [] })
  medias?: MessageMedia[];

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }],
    default: [],
  })
  readBy: UserDocument[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Message.name })
  replyTo?: MessageDocument;

  @Prop({ type: String })
  voiceMessageDuration?: string;

  @Prop({ enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
