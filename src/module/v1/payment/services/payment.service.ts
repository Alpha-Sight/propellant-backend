import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Payment, PaymentDocument } from '../schema/payment.schema';
import { Model } from 'mongoose';
import {
  CreatePaymentDto,
  GetPaymentDto,
  UpdatePaymentDto,
} from '../dto/payment.dto';
import { PaystackService } from './paystack.service';
import { FlutterwaveService } from './flutterwave.service';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { RepositoryService } from '../../repository/repository.service';
import { PaymentProvidersEnum } from 'src/common/enums/payment.enum';
import {
  IBaseInitializePayment,
  IFlutterwaveInitializePayment,
} from 'src/common/interfaces/payment.interface';
import { BaseRepositoryService } from '../../repository/base.service';
import { PremiumService } from '../../premium/premium.service';
import { SubscriptionTypeEnum } from 'src/common/enums/premium.enum';

@Injectable()
export class PaymentService extends BaseRepositoryService<PaymentDocument> {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private paystackService: PaystackService,
    private flutterwaveService: FlutterwaveService,
    private repositoryService: RepositoryService,
    private premiumService: PremiumService,
  ) {
    super(paymentModel);
  }

  async create(payload: CreatePaymentDto) {
    const { name } = payload;

    const paymentWithNameExist = await this.paymentModel.countDocuments({
      name,
    });

    if (paymentWithNameExist) {
      throw new BadRequestException(
        `Payment with name "${name}" already exists`,
      );
    }

    const uploadedImageUrl = null;
    // if (file) {
    //   const { mimetype, buffer } = file;

    //   const awsFile: IAwsUploadFile = {
    //     fileName: BaseHelper.generateFileName('payment', mimetype),
    //     mimetype,
    //     buffer,
    //   };

    //   const { secureUrl } = await uploadSingleFile(awsFile);
    //   uploadedImageUrl = secureUrl;
    // }

    return await this.paymentModel.create({
      ...payload,
      ...(uploadedImageUrl && { imageUrl: uploadedImageUrl }),
    });
  }

  async update(
    id: string,
    payload: UpdatePaymentDto,
    file?: Express.Multer.File,
  ) {
    console.log('payload', payload);

    const uploadedImageUrl = null;

    if (file) {
      // const { mimetype, buffer } = file;
      // const awsFile: IAwsUploadFile = {
      //   fileName: BaseHelper.generateFileName('payment', mimetype),
      //   mimetype,
      //   buffer,
      // };
      // const { secureUrl } = await uploadSingleFile(awsFile);
      // uploadedImageUrl = secureUrl;
    }

    const updatedPayment = await this.paymentModel.findByIdAndUpdate(
      id,
      { ...payload, ...(uploadedImageUrl && { imageUrl: uploadedImageUrl }) },
      {
        new: true,
      },
    );

    if (!updatedPayment) {
      throw new NotFoundException('Payment not found');
    }

    return updatedPayment;
  }

  async delete(id: string) {
    return await this.paymentModel.findOneAndUpdate(
      {
        _id: id,
        isDeleted: false,
      },
      {
        isDeleted: true,
      },
      {
        new: true,
      },
    );
  }

  async getAll(query: GetPaymentDto) {
    const { currencyId } = query;

    return await this.paymentModel.find({
      ...(currencyId && {
        supportedCurrencies: currencyId,
      }),
    });
  }

  async getAllPaymentMethods(query: PaginationDto) {
    return await this.repositoryService.paginate({
      model: this.paymentModel,
      query,
    });
  }

  async checkPaymentMethodAvailability(paymentId: string) {
    const payment = await this.paymentModel.findOne({
      _id: paymentId,
      active: true,
      isDeleted: false,
    });

    if (!payment) {
      throw new NotFoundException('Payment method not available');
    }

    return payment;
  }

  async getPaymentMethodByName(name: string) {
    return this.paymentModel
      .findOne({
        name,
        active: true,
      })
      .populate('apiKey');
  }

  async initializePaymentByActiveProvider(
    payload: IBaseInitializePayment | IFlutterwaveInitializePayment,
  ) {
    const activePaymentProvider = (await this.paymentModel.findOne({
      active: true,
    })) as PaymentDocument;

    if (!activePaymentProvider) {
      throw new NotFoundException('No active payment provider found');
    }

    return this.initializePaymentByPaymentProvider(
      activePaymentProvider.name as PaymentProvidersEnum,
      payload,
    );
  }

  async initializePaymentByPaymentProvider(
    name: PaymentProvidersEnum,
    payload: IBaseInitializePayment | IFlutterwaveInitializePayment,
  ) {
    switch (name) {
      case PaymentProvidersEnum.PAYSTACK:
        return this.paystackService.initializePayment(
          payload as IBaseInitializePayment,
        );
      case PaymentProvidersEnum.FLUTTERWAVE:
        return this.flutterwaveService.initializePayment(
          payload as IFlutterwaveInitializePayment,
        );
      default:
        throw new BadRequestException('Invalid payment provider');
    }
  }

  async processPremiumPayment(payload: {
    reference: string;
    transactionId: string;
    paymentObject: object;
    amountPaid: number;
    userIdFromMetadata?: string;
    plan: SubscriptionTypeEnum;
  }) {
    return await this.premiumService.upgradeToPremium(
      payload.userIdFromMetadata,
      payload.amountPaid,
      payload.paymentObject,
      payload.plan,
    );
  }
}
