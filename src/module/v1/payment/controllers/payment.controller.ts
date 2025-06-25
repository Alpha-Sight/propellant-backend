import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import {
  CreatePaymentDto,
  GetPaymentDto,
  UpdatePaymentDto,
} from '../dto/payment.dto';
import { Public } from '../../../../common/decorators/public.decorator';
import { CacheExpiry } from '../../../../common/decorators/cache.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { CACHE_EXPIRY } from 'src/common/constants/cache.constant';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Public()
  @CacheExpiry(CACHE_EXPIRY.ONE_HOUR)
  @Get()
  async getAll(@Query() query: GetPaymentDto) {
    return await this.paymentService.getAll(query);
  }

  @Get('admin')
  // @UseGuards(RoleGuard)
  // @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  async getAllForAdmin(@Query() query: PaginationDto) {
    return await this.paymentService.getAllPaymentMethods(query);
  }

  // @UseGuards(RoleGuard)
  // @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @Post()
  async create(
    @Body() payload: CreatePaymentDto,
    // @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.paymentService.create(payload);
  }

  // @UseGuards(RoleGuard)
  // @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @Patch(':id')
  async updatePayment(
    @Param('id') id: string,
    @Body() payload: UpdatePaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.paymentService.update(id, payload, file);
  }

  // @UseGuards(RoleGuard)
  // @Roles(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN)
  @Delete(':id')
  async deletePayment(@Param('id') id: string) {
    return await this.paymentService.delete(id);
  }
}
