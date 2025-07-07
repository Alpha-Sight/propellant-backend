// import {
//   BadRequestException,
//   Injectable,
//   InternalServerErrorException,
// } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { ClientSession, FilterQuery, Model } from 'mongoose';
// import { RepositoryService } from 'src/module/v1/repository/repository.service';
// import { UserDocument } from 'src/module/v1/user/schemas/user.schema';
// import {
//   MessageReaction,
//   MessageReactionDocument,
// } from '../schema/message-reaction.schema';
// import { MessageService } from './message.service';
// import { ReactionTypeEnum } from 'src/common/enums/reaction.enum';
// import { PaginationDto } from '../../repository/dto/repository.dto';

// @Injectable()
// export class MessageReactionService {
//   constructor(
//     @InjectModel(MessageReaction.name)
//     private messageReactionModel: Model<MessageReactionDocument>,
//     private readonly messageService: MessageService,
//     private repositoryService: RepositoryService,
//     // private notificationService: NotificationService,
//   ) {}

//   async addReaction(user: UserDocument, payload: ReactTypeDto) {
//     const session: ClientSession =
//       await this.messageReactionModel.db.startSession();
//     session.startTransaction();

//     try {
//       const { resourceId, type, reaction } = payload;

//       // find the resource
//       const message = await this.messageService.findOneById(resourceId);
//       if (!message) {
//         throw new BadRequestException(
//           `Unable to add reaction, message not found`,
//         );
//       }

//       // get the reaction of the user
//       const userReacted = await this.messageReactionModel.findOne({
//         user: user._id,
//         [type]: resourceId,
//       });

//       // id of the user who is receiving the reaction
//       const messageOwner = message.sender;

//       // check if notification should be sent
//       let addNotification = false;

//       if (
//         userReacted &&
//         userReacted?.reaction === reaction &&
//         !userReacted?.isDeleted
//       ) {
//         await this.unReact(resourceId, session);
//       } else {
//         if (userReacted) {
//           // check if user has already reacted to the resource and if the reaction is different from the current one
//           if (userReacted?.reaction !== reaction) {
//             await this.messageReactionModel.updateOne(
//               { user: user._id, message: resourceId },
//               { reaction },
//               { session },
//             );
//           } else if (userReacted?.isDeleted) {
//             await this.messageReactionModel.updateOne(
//               { user: user._id, message: resourceId },
//               { reaction, isDeleted: false },
//               { session },
//             );
//           }
//         } else {
//           // add reaction to the resource if the user has not reacted to it yet
//           await this.messageReactionModel.create(
//             [
//               {
//                 user: user._id,
//                 message: resourceId,
//                 reaction,
//                 type,
//               },
//             ],
//             { session },
//           );
//           addNotification = true;
//         }
//       }

//       await session.commitTransaction();
//       await session.endSession();

//       // send notifications
//     //   if (addNotification == true && messageOwner !== user._id) {
//     //     // send notifications
//     //   //   switch (type) {
//     //   //     case ReactionTypeEnum.MESSAGE:
//     //   //   //     await this.notificationService.create(
//     //   //   //       {
//     //   //   //         title: `New reaction on your message`,
//     //   //   //         body: `${user?.username} reacted to your message`,
//     //   //   //         clickAction: `OPEN_MESSAGE_${resourceId}`,
//     //   //   //       },
//     //   //   //       messageOwner,
//     //   //   //       true,
//     //   //   //     );
//     //   //   //     break;
//     //   //   // }
//     //   // }

//     //   return;
//     // } catch (error) {
//     //   await session.abortTransaction();
//     //   if (error instanceof InternalServerErrorException) {
//     //     throw new InternalServerErrorException(error.message);
//     //   }
//     //   throw new BadRequestException(error.message);
//     // }
//   }

//   async unReact(messageId: string, session?: ClientSession) {
//     await this.messageReactionModel.updateOne(
//       { message: messageId },
//       { isDeleted: true },
//       { session },
//     );
//   }

//   async checkUserReacted(messageId: string, userId: string): Promise<boolean> {
//     const reaction = await this.messageReactionModel.findOne({
//       message: messageId,
//       user: userId,
//       isDeleted: false,
//     });
//     return !!reaction;
//   }

//   async showMessageReactions(messageId: string) {
//     return this.messageReactionModel
//       .find({ message: messageId })
//       .populate('user');
//   }

//   async findOneByMessageIdAndUserId(messageId: string, userId: string) {
//     return this.messageReactionModel.findOne({
//       message: messageId,
//       user: userId,
//     });
//   }

//   async getReactedMessages(user: UserDocument, query: PaginationDto) {
//     return this.repositoryService.paginate(
//       this.messageReactionModel,
//       query,
//       {
//         user: user._id,
//         type: ReactionTypeEnum.MESSAGE,
//         isDeleted: false,
//       },
//       'message',
//     );
//   }

//   async findOneQuery(query: FilterQuery<MessageReactionDocument>) {
//     return this.messageReactionModel.findOne(query);
//   }
// }
