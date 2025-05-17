import { Body, Controller, Post } from '@nestjs/common';
import { ResponseMessage } from '../../../common/decorators/response.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RESPONSE_CONSTANT } from '../../../common/constants/response.constant';
import { OtpService } from './services/otp.service';
import { NoCache } from '../../../common/decorators/cache.decorator';

@NoCache()
@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Public()
  @ResponseMessage(RESPONSE_CONSTANT.OTP.OTP_SENT_SUCCESS)
  @Post('/request')
  async requestOTP(@Body() payload: RequestOtpDto) {
    return await this.otpService.sendOTP(payload);
  }

  @Public()
  @ResponseMessage(RESPONSE_CONSTANT.OTP.OTP_VERIFIED_SUCCESS)
  @Post('/verify')
  async verifyOTP(@Body() payload: VerifyOtpDto) {
    return await this.otpService.verifyOTP(payload);
  }
}
