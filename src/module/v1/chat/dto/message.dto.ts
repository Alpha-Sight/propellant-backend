import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @IsOptional()
  content?: string;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;

  @ValidateIf((o) => !o.recipientId)
  @IsMongoId({ message: 'Invalid chat id' })
  chatId: string;

  @ValidateIf((o) => !o.chatId)
  @IsMongoId({ message: 'Invalid user id' })
  recipientId: string;
}

export class ReadMessageDto {
  @IsMongoId()
  messageId: string;
}
