import { IsArray, IsNotEmpty } from 'class-validator';

export class CreateChatDto {
  @IsNotEmpty()
  @IsArray()
  participants: string[];
}
