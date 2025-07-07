import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { ClientSession, FilterQuery, Model, UpdateQuery } from 'mongoose';
import { RepositoryService } from '../repository/repository.service';
import { UserDocument } from '../user/schemas/user.schema';
import {
  CreateTransactionDto,
  GetUserTransactionsDto,
} from './dto/transaction.dto';
import { TransactionStatusEnum } from '../../../common/enums/transaction.enum';
import { BaseRepositoryService } from '../repository/base.service';

@Injectable()
export class TransactionService extends BaseRepositoryService<TransactionDocument> {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    private readonly repositoryService: RepositoryService,
  ) {
    super(transactionModel);
  }

  async startSession(): Promise<ClientSession> {
    return this.transactionModel.db.startSession();
  }

  async getTransactionByReference(
    reference: string,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({ reference: reference });
  }

  async create(
    payload: CreateTransactionDto,
    session?: ClientSession,
  ): Promise<TransactionDocument> {
    const transaction = await this.transactionModel.create([payload], {
      ...(session ? { session } : {}),
    });

    const createdTransaction = (transaction[0] ||
      transaction) as TransactionDocument;

    return createdTransaction;
  }

  async updateTransactionStatusById(id: string, status: TransactionStatusEnum) {
    return this.transactionModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
  }

  async failTransactionById(id: string, errorMessage: string) {
    return this.transactionModel.findByIdAndUpdate(
      id,
      { status: TransactionStatusEnum.Failed, errorMessage },
      { new: true },
    );
  }

  async userTransactions(user: UserDocument, query: GetUserTransactionsDto) {
    const { type, status, ...paginationQuery } = query;

    const filterQuery: FilterQuery<TransactionDocument> = {
      user: user._id,
    };

    if (type) {
      filterQuery.type = type;
    }

    if (status) {
      filterQuery.status = status;
    }

    return this.repositoryService.paginate({
      model: this.transactionModel,
      query: paginationQuery,
      options: filterQuery,
    });
  }

  async findQuery(
    query: FilterQuery<TransactionDocument>,
    selectFields?: string[],
    populateFields?: string,
  ) {
    return this.transactionModel
      .find(query)
      .select(selectFields.map((field) => `+${field}`).join(' '))
      .populate(populateFields);
  }

  async updateSingleQuery(
    query: FilterQuery<TransactionDocument>,
    update: UpdateQuery<TransactionDocument>,
    session?: ClientSession,
  ) {
    return await this.transactionModel.findOneAndUpdate(query, update, {
      new: true,
      ...(session ? { session } : {}),
    });
  }
}
