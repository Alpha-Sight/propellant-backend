import { Module } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from './schema/chat.schema';
import { Message, MessageSchema } from './schema/message.schema';
import { RepositoryModule } from '../repository/repository.module';
import { MessageController } from './controllers/message.controller';
import { MessageService } from './services/message.service';
import { ChatGateway } from './chat.gateway';
import { UserModule } from '../user/user.module';
import { ActiveUserService } from './services/chat-active-user.service';
import { PinataService } from 'src/common/utils/pinata.util';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Chat.name,
        schema: ChatSchema,
      },
      {
        name: Message.name,
        schema: MessageSchema,
      },
    ]),
    RepositoryModule,
    UserModule,
    // NotificationModule,
  ],
  controllers: [ChatController, MessageController],
  providers: [
    ChatService,
    MessageService,
    ChatGateway,
    ActiveUserService,
    PinataService,
  ],
  exports: [ChatService, MessageService, PinataService],
})
export class ChatModule {}
