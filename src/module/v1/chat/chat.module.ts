// import { Module } from '@nestjs/common';
// import { ChatService } from './services/chat.service';
// import { ChatController } from './controllers/chat.controller';
// import { MongooseModule } from '@nestjs/mongoose';
// import { Chat, ChatSchema } from './schema/chat.schema';
// import { Message, MessageSchema } from './schema/message.schema';
// import { RepositoryModule } from '../repository/repository.module';
// import { MessageController } from './controllers/message.controller';
// import { MessageService } from './services/message.service';
// import { ChatGateway } from './chat.gateway';
// import { UserModule } from '../user/user.module';
// import {
//   MessageReaction,
//   MessageReactionSchema,
// } from './schema/message-reaction.schema';
// import { MessageReactionController } from './controllers/message-reaction.controller';
// import { MessageReactionService } from './services/message-reaction.services';
// import { ActiveUserService } from './services/chat-active-user.service';

// @Module({
//   imports: [
//     MongooseModule.forFeature([
//       {
//         name: Chat.name,
//         schema: ChatSchema,
//       },
//       {
//         name: Message.name,
//         schema: MessageSchema,
//       },
//       {
//         name: MessageReaction.name,
//         schema: MessageReactionSchema,
//       },
//     ]),
//     RepositoryModule,
//     UserModule,
//     // NotificationModule,
//   ],
//   controllers: [ChatController, MessageController, MessageReactionController],
//   providers: [
//     ChatService,
//     MessageService,
//     ChatGateway,
//     MessageReactionService,
//     ActiveUserService,
//   ],
//   exports: [ChatService, MessageService, MessageReactionService],
// })
// export class ChatModule {}
