import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { CreateChatDto } from '../dto/chat.dto';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { UserDocument } from '../../user/schemas/user.schema';
import { LoggedInUserDecorator } from 'src/common/decorators/logged-in-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // TODO: remove this later
  @Post()
  async create(@Body() payload: CreateChatDto) {
    return await this.chatService.create(payload);
  }

  @Get()
  async getUserChats(
    @Query() query: PaginationDto,
    @LoggedInUserDecorator() user: UserDocument,
  ) {
    return await this.chatService.getUserChats(user, query);
  }
}
