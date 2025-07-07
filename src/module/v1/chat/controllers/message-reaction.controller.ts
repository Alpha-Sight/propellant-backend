// import { Body, Controller, Patch } from '@nestjs/common';
// import { LoggedInUserDecorator } from 'src/common/decorators/logged_in_user.decorator';
// import { UserDocument } from 'src/module/v1/user/schemas/user.schema';
// import { ReactTypeDto } from '../../reel/dto/reaction.dto';
// import { MessageReactionService } from '../services/message-reaction.services';

// @Controller('message/reaction')
// export class MessageReactionController {
//   constructor(private readonly messageReactionService: MessageReactionService) {}

//   @Patch('react')
//   async react(@Body() payload: ReactTypeDto, @LoggedInUserDecorator() user: UserDocument) {
//     return await this.messageReactionService.addReaction(user, payload);
//   }
// }
