// import { Body, Controller, Get, Post, Query } from '@nestjs/common';
// import { ChatService } from '../services/chat.service';
// import { CreateChatDto } from '../dto/chat.dto';
// import { LoggedInUserDecorator } from '../../../../common/decorators/logged_in_user.decorator';
// import { PaginationDto } from '../../repository/dto/repository.dto';
// import { UserDocument } from '../../user/schemas/user.schema';

// @Controller('chat')
// export class ChatController {
//   constructor(private readonly chatService: ChatService) {}

//   // TODO: remove this later
//   @Post()
//   async create(@Body() payload: CreateChatDto) {
//     return await this.chatService.create(payload);
//   }

//   @Get()
//   async getUserChats(@Query() query: PaginationDto, @LoggedInUserDecorator() user: UserDocument) {
//     return await this.chatService.getUserChats(user, query);
//   }
// }
