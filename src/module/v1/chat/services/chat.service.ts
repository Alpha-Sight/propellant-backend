// import { BadRequestException, Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { ClientSession, FilterQuery, Model } from 'mongoose';
// import { Chat, ChatDocument } from '../schema/chat.schema';
// import { CreateChatDto } from '../dto/chat.dto';
// import { RepositoryService } from '../../repository/repository.service';
// import { UserDocument } from '../../user/schemas/user.schema';
// import { PaginationDto } from '../../repository/dto/repository.dto';
// import { MessageService } from './message.service';

// @Injectable()
// export class ChatService {
//   constructor(
//     @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
//     private repositoryService: RepositoryService,
//     private messageService: MessageService,
//   ) {}

//   async create(payload: CreateChatDto) {
//     const { participants } = payload;

//     if (participants.length < 2) {
//       throw new BadRequestException('Chat must have at least 2 participants');
//     }

//     const chatExist = await this.chatModel.findOne({
//       participants: { $all: participants },
//     });

//     if (chatExist) {
//       console.log('chat exist');
//       return chatExist;
//     }

//     return await this.chatModel.create({
//       participants,
//     });
//   }

//   async getUserChats(user: UserDocument, query: PaginationDto) {
//     const chats = await this.repositoryService.paginate(this.chatModel, query, {
//       participants: { $in: [user._id] },
//     });

//     chats.data = await Promise.all(
//       chats.data.map(async (chat: ChatDocument) => {
//         const unreadMessageCount = await this.messageService.countUnreadMessage(
//           chat._id,
//           user,
//         );
//         return {
//           ...chat.toObject(),
//           unreadMessageCount,
//         };
//       }),
//     );

//     return chats;
//   }

//   async getChatById(chatId: string) {
//     return await this.chatModel.findById(chatId).populate('participants');
//   }

//   async findOneQuery(query: FilterQuery<ChatDocument>) {
//     return this.chatModel.findOne(query);
//   }

//   async updateQuery(
//     chatId: string,
//     query: FilterQuery<ChatDocument>,
//     session?: ClientSession,
//   ) {
//     return this.chatModel.findOneAndUpdate({ _id: chatId }, query, { session });
//   }
// }
