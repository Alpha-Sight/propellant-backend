import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { Message, MessageDocument } from './message.schema';
import { ReactionEnum, ReactionTypeEnum } from 'src/common/enums/reaction.enum';

export type MessageReactionDocument = MessageReaction & Document;

@Schema({ timestamps: true })
export class MessageReaction {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Message.name })
  message?: MessageDocument;

  @Prop({ required: true, enum: ReactionEnum })
  reaction: ReactionEnum;

  @Prop({ type: String, enum: ReactionTypeEnum, required: true })
  type: ReactionTypeEnum;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  user: UserDocument; // user who reacted to the resource

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const MessageReactionSchema =
  SchemaFactory.createForClass(MessageReaction);
