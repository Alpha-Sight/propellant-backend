// import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
// import { MessageService } from '../services/message.service';
// import { CreateMessageDto, ReadMessageDto } from '../dto/message.dto';
// import { LoggedInUserDecorator } from '../../../../common/decorators/logged_in_user.decorator';
// import { UserDocument } from '../../user/schemas/user.schema';
// import { FilesInterceptor } from '@nestjs/platform-express';
// import { PaginationDto } from '../../repository/dto/repository.dto';

// @Controller('chat/message')
// export class MessageController {
//   constructor(private readonly messageService: MessageService) {}

//   @UseInterceptors(FilesInterceptor('medias'))
//   @Post('send')
//   async sendMessage(
//     @Body() payload: CreateMessageDto,
//     @LoggedInUserDecorator() user: UserDocument,
//     @UploadedFiles() medias?: Array<Express.Multer.File>,
//   ) {
//     return await this.messageService.sendMessage(payload, user, medias);
//   }

//   @Get(':chatId')
//   async getMessages(
//     @Query() query: PaginationDto,
//     @Param('chatId') chatId: string,
//     @LoggedInUserDecorator() user: UserDocument,
//   ) {
//     return await this.messageService.getMessages(chatId, user, query);
//   }

//   @Post('read')
//   async readMessage(@Body() payload: ReadMessageDto, @LoggedInUserDecorator() user: UserDocument) {
//     return await this.messageService.readMessage(payload, user);
//   }
// }
