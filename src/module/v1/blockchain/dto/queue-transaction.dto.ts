import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class QueueTransactionDto {
  @IsString()
  userAddress: string;

  @IsString()
  target: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  data: string;

  @IsNumber()
  @IsOptional()
  operation?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isAccountCreation?: boolean;
}