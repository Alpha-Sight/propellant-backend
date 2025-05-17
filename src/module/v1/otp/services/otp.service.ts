import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { OTP, OTPDocument } from '../schemas/otp.schema';
import { Model } from 'mongoose';
import { CreateOtpDto, RequestOtpDto, VerifyOtpDto } from '../dto/otp.dto';
import { OtpTypeEnum } from '../../../../common/enums/otp.enum';
import { BaseHelper } from '../../../../common/utils/helper/helper.util';
import { OtpMailService } from './otp-mail.service';
import { TwilioSms } from 'src/common/utils/twillio.utils';
import { UserService } from '../../user/services/user.service';
import { MailService } from '../../mail /mail.service';
import {
  VerifyEmailTemplate,
  VerifyPhoneTemplate,
} from '../../mail /templates/verify-email.email';
import { ForgotPasswordTemplate } from '../../mail /templates/forgot-password.email';

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(OTP.name) private otpModel: Model<OTPDocument>,
    private readonly mailService: MailService,
    private readonly otpMailService: OtpMailService,
    @Inject(forwardRef(() => UserService)) private userService: UserService,
  ) {}

  async createOTP(payload: CreateOtpDto): Promise<OTPDocument> {
    return this.otpModel.findOneAndUpdate(
      {
        $or: [{ email: payload.email }, { phone: payload.phone }],
      },
      payload,
      {
        upsert: true,
        new: true,
      },
    );
  }

  /**
   * Verifies the OTP code and optionally removes it from the database
   * otp can be verified without being removed just to check it is valid or not
   */
  async verifyOTP(payload: VerifyOtpDto, remove?: boolean) {
    const { code, email, phone, type } = payload;

    let otp: OTPDocument;

    if (remove) {
      otp = await this.otpModel.findOneAndDelete(
        {
          ...(email ? { email, code, type } : { phone, code, type }),
        },
        { new: true },
      );
    } else {
      otp = await this.otpModel.findOne({
        ...(email ? { email, code, type } : { phone, code, type }),
      });
    }

    if (!otp) {
      throw new NotFoundException('Invalid or Expired OTP code');
    }

    return otp;
  }

  async sendOTP(payload: RequestOtpDto) {
    const { email, phone, type } = payload;

    // check if user with email or phone exists
    const user = await this.userService.findOneQuery({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      const message = email
        ? 'No User found with the email you provided'
        : 'No User found with the phone number you provided';
      throw new NotFoundException(message);
    }

    const code = BaseHelper.generateOTP();

    let template: string;
    let subject: string;

    if (email) {
      switch (type) {
        case OtpTypeEnum.RESET_PASSWORD:
          template = ForgotPasswordTemplate({ code });
          subject = 'Reset Your Password';
          break;
        case OtpTypeEnum.VERIFY_EMAIL:
          template = VerifyEmailTemplate({ code });
          subject = 'Verify Email';
          break;
        case OtpTypeEnum.WITHDRAWAL_ACCOUNT:
          template = VerifyEmailTemplate({ code });
          subject = 'Verify Withdrawal Account';
          break;
      }
    } else {
      template = VerifyPhoneTemplate({ code });
      subject = 'Verify Your Phone Number';
    }

    const otp = await this.createOTP({
      email,
      code,
      type,
    });

    if (!otp)
      throw new InternalServerErrorException(
        'Unable to send otp at the moment , try again later',
      );

    if (email) {
      await this.mailService.sendEmail(email, subject, template);
    } else {
      await TwilioSms(phone, template);
    }
  }

  async deleteOTP(id: string) {
    return this.otpModel.findByIdAndDelete(id);
  }
}
