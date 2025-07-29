import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message, MessageDocument } from '../schema/message.schema';
import { Model } from 'mongoose';
import { ChatService } from './chat.service';
import { CreateMessageDto, ReadMessageDto } from '../dto/message.dto';
import { UserDocument } from '../../user/schemas/user.schema';
import { ChatDocument } from '../schema/chat.schema';
import { RepositoryService } from '../../repository/repository.service';
// import { PaginationDto } from '../../repository/dto/repository.dto';
import { ChatGateway } from '../chat.gateway';
import { BaseHelper } from 'src/common/utils/helper/helper.util';
import {
  MessageMediaTypeEnum,
  MessageStatus,
} from 'src/common/enums/message.enum';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { PinataService } from 'src/common/utils/pinata.util';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @Inject(forwardRef(() => ChatService)) private chatService: ChatService,
    private repositoryService: RepositoryService,
    private chatGateway: ChatGateway,
    private pinataService: PinataService,
  ) {}

  async sendMessage(
    payload: CreateMessageDto,
    user: UserDocument,
    medias?: Array<Express.Multer.File>,
  ) {
    const { chatId, content, recipientId, replyTo } = payload;

    let chat: ChatDocument;

    if (chatId) {
      chat = await this.chatService.getChatById(chatId);

      if (!chat) {
        throw new NotFoundException('Chat does not exist');
      }
    }

    if (recipientId) {
      chat = await await this.chatService.findOneQuery({
        participants: { $in: [user._id, recipientId] },
      });

      if (!chat) {
        chat = await (
          await this.chatService.create({
            participants: [user._id.toString(), recipientId],
          })
        ).populate('participants');
      }
    }

    if (!chat) {
      throw new BadRequestException('Unable to send message, try again later');
    }

    if (replyTo) {
      await this.replyToMessage(replyTo, chat._id.toString());
    }

    let uploadedMedias = [];
    let voiceMessageDuration = '';

    if (medias && medias.length > 0) {
      uploadedMedias = await Promise.all(
        medias.map(async (file) => {
          const fileType = BaseHelper.getFileTypeFromMimeType(file.mimetype);

          // Check if the file type is audio
          if (fileType === MessageMediaTypeEnum.AUDIO) {
            if (medias && medias.length > 1) {
              throw new BadRequestException(
                'Only one audio file can be uploaded at a time.',
              );
            }
            if (content) {
              throw new BadRequestException(
                'Audio and text cannot be uploaded together.',
              );
            }

            // Calculate voice message duration for the audio file
            voiceMessageDuration =
              await BaseHelper.calculateAudioDuration(file);
          }

          //   const uploadRes = await uploadSingleFile(file, 'messages');
          const uploadRes = await this.pinataService.uploadFile(
            file,
            'messages',
          );

          return {
            url: `https://gateway.pinata.cloud/ipfs/${uploadRes}`,
            backupUrl: `https://ipfs.io/ipfs/${uploadRes}`,
            type: fileType,
          };
        }),
      );
    }

    const session = await this.messageModel.startSession();
    session.startTransaction();
    try {
      // Retrieve the recipient user from the chat participants
      const recipientUser = chat.participants.find(
        (p: UserDocument) => p._id.toString() !== user._id.toString(),
      );

      const recipientSocketData = await this.chatGateway.getUserSocketDataById(
        recipientUser._id.toString(),
      );
      const senderSocketData = await this.chatGateway.getUserSocketDataById(
        user._id.toString(),
      );

      // If both participants are active, message status should be DELIVERED else SENT
      const messageStatus =
        recipientSocketData?.isActive && senderSocketData?.isActive
          ? MessageStatus.DELIVERED
          : MessageStatus.SENT;

      const createdMessage = (
        await this.messageModel.create(
          [
            {
              content,
              sender: user._id,
              chat: chat._id,
              ...(uploadedMedias && { medias: uploadedMedias }),
              ...(voiceMessageDuration && { voiceMessageDuration }),
              ...(replyTo && { replyTo }),
              status: messageStatus,
            },
          ],
          { session },
        )
      )[0];

      if (!createdMessage) {
        throw new BadRequestException(
          'Unable to send message, try again later',
        );
      }

      // update chat last message
      await this.chatService.updateQuery(
        chat._id.toString(),
        { lastMessage: createdMessage._id },
        session,
      );

      await session.commitTransaction();
      session.endSession();

      // TODO: move this to a queue
      // send notification to chat participant
      const recipient = chat.participants.find(
        (p: UserDocument) => p._id.toString() !== user._id.toString(),
      );

      await Promise.allSettled([
        this.chatGateway.broadcastEvent(
          recipient?._id.toString(),
          'new-message',
          createdMessage,
        ),
      ]);

      return createdMessage;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      throw new BadRequestException(
        error?.message ?? 'Unable to send message, try again later',
      );
    }
  }

  async getMessages(chatId: string, user: UserDocument, query: PaginationDto) {
    // check if user is in chat
    const chat = await this.chatService.getChatById(chatId);

    if (!chat) {
      throw new NotFoundException('Chat does not exist');
    }

    if (
      !chat.participants.some((p) => p._id.toString() === user._id.toString())
    ) {
      throw new ForbiddenException('You are not a participant of this chat');
    }

    return await this.repositoryService.paginate({
      model: this.messageModel,
      query,
      options: { chat: chatId },
    });
  }

  async readMessage(payload: ReadMessageDto, user: UserDocument) {
    const { messageId } = payload;

    const message = await this.messageModel.findById(messageId).populate<{
      chat: {
        participants: UserDocument[];
      };
    }>({
      path: 'chat',
      populate: {
        path: 'participants',
      },
    });

    if (!message) {
      throw new NotFoundException('Message does not exist');
    }

    if (
      !message.chat.participants.some(
        (p: UserDocument) => p._id.toString() === user._id.toString(),
      )
    ) {
      throw new ForbiddenException('You are not a participant of this chat');
    }
    if (
      message.readBy.map((id) => id.toString()).includes(user._id.toString())
    ) {
      return;
    }

    await this.messageModel.updateOne(
      { _id: messageId },
      { $push: { readBy: user._id }, status: MessageStatus.READ },
    );
  }

  async countUnreadMessage(chatId: string, user: UserDocument) {
    const unreadMessageCount = await this.messageModel.countDocuments({
      chat: chatId,
      readBy: { $ne: user._id },
    });

    return unreadMessageCount ?? 0;
  }

  async findOneById(messageId: string) {
    return this.messageModel.findById(messageId).populate('sender');
  }

  async replyToMessage(
    replyTo: string,
    chatId: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(replyTo);
    if (!message) {
      throw new BadRequestException(
        'Failed to send the reply. The original message could not be found.',
      );
    }

    if (message.chat.toString() !== chatId.toString()) {
      throw new BadRequestException(
        'You can only reply to messages within the same chat',
      );
    }

    return message;
  }
}
