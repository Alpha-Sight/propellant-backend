import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class QueueTransactionDto {
  @IsString()
  @IsNotEmpty()
  userAddress: string;

  @IsString()
  @IsNotEmpty()
  target: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsNotEmpty()
  data: string;

  @IsNumber()
  operation: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}
