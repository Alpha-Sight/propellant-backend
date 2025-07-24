import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class QueueTransactionDto {
  @IsNotEmpty()
  @IsString()
  userAddress: string;

  @IsNotEmpty()
  @IsString()
  target: string;

  @IsNotEmpty()
  @IsString()
  value: string;

  @IsNotEmpty()
  @IsString()
  data: string;

  @IsNotEmpty()
  @IsNumber()
  operation: number;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  isAccountCreation?: boolean;
}

