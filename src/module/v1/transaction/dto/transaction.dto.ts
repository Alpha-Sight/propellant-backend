import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';
import { PaginationDto } from '../../repository/dto/repository.dto';
import {
  TransactionStatusEnum,
  TransactionTypeEnum,
} from '../../../../common/enums/transaction.enum';

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsMongoId()
  user: string;

  @IsNotEmpty()
  @IsEnum(TransactionTypeEnum)
  type: TransactionTypeEnum;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsNumber()
  settlement?: number;

  @IsOptional()
  @IsMongoId()
  basket?: string;

  @IsOptional()
  @IsMongoId()
  withdrawalAccount?: string;

  @IsOptional()
  @IsString()
  discription?: string;

  @IsOptional()
  @IsMongoId()
  paymentMethod?: string;

  @IsOptional()
  @IsEnum(TransactionStatusEnum)
  status?: TransactionStatusEnum;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  metadata?: any;
}

export class GetUserTransactionsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TransactionTypeEnum)
  type?: TransactionTypeEnum;

  @IsOptional()
  @IsEnum(TransactionStatusEnum)
  status?: TransactionStatusEnum;
}
