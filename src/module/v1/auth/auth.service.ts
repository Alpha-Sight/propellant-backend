import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  forwardRef,
  UnprocessableEntityException,
  HttpStatus,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/user.dto';
import { UserService } from '../user/services/user.service';
import {
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  RequestVerifyEmailOtpDto,
  ResetPasswordDto,
  VerifyEmailDto,
  WalletLoginDto,
} from './dto/auth.dto';
import { BaseHelper } from '../../../common/utils/helper/helper.util';
import { OtpService } from '../otp/services/otp.service';
import { ENVIRONMENT } from '../../../common/configs/environment';
import { AuthSourceEnum } from '../../../common/enums/user.enum';
import { OtpTypeEnum } from '../../../common/enums/otp.enum';
import { MailService } from '../mail/mail.service';
import { welcomeEmailTemplate } from '../mail/templates/welcome.email';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from 'src/common/constants/error-codes.constant';
import { AppError } from 'src/common/filter/app-error.filter';
import { cacheKeys } from 'src/common/constants/cache.constant';
import { CacheHelperUtil } from 'src/common/utils/cache-helper.util';
import { UserDocument } from '../user/schemas/user.schema';
import { authConstants } from 'src/common/constants/authConstant';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @Inject(forwardRef(() => OtpService))
    private readonly otpService: OtpService,
    private mailService: MailService,
  ) {}

  async register(payload: CreateUserDto) {
    await this.otpService.sendOTP({
      email: payload.email,
      type: OtpTypeEnum.VERIFY_EMAIL,
    });

    return await this.userService.createUser(payload);
  }

  async login(payload: LoginDto) {
    const { email, password } = payload;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.userService.getUserDetailsWithPassword({ email });

    if (!user) {
      throw new BadRequestException('Invalid Credential');
    }

    const passwordMatch = await BaseHelper.compareHashedData(
      password,
      user.password,
    );

    if (!passwordMatch) {
      throw new BadRequestException('Incorrect Password');
    }

    if (!user.emailVerified) {
      throw new AppError(
        'kindly verify your email to login',
        HttpStatus.BAD_REQUEST,
        ERROR_CODES.EMAIL_NOT_VERIFIED,
      );
    }

    const token = this.jwtService.sign(
      { _id: user._id },
      {
        secret: ENVIRONMENT.JWT.SECRET,
      },
    );
    delete user['_doc'].password;

    return {
      ...user['_doc'],
      accessToken: token,
    };
  }

  // async verifyEmail(payload: VerifyEmailDto) {
  //   const { code, email } = payload;

  //   const user = await this.userService.getUserByEmail(email);

  //   if (!user) {
  //     throw new BadRequestException('Invalid Email');
  //   }

  //   if (user.emailVerified) {
  //     throw new UnprocessableEntityException('Email already verified');
  //   }

  //   await this.otpService.verifyOTP(
  //     {
  //       code,
  //       email,
  //       type: OtpTypeEnum.VERIFY_EMAIL,
  //     },
  //     true,
  //   );

  //   await this.userService.updateQuery(
  //     { email },
  //     {
  //       emailVerified: true,
  //     },
  //   );

  //   const welcomeEmailName = user?.email || 'User';
  //   await this.mailService.sendEmail(
  //     user.email,
  //     `Welcome To ${ENVIRONMENT.APP.NAME}`,
  //     welcomeEmailTemplate({
  //       name: welcomeEmailName,
  //     }),
  //   );
  // }

  async verifyEmail(payload: VerifyEmailDto) {
    const { code, email } = payload;

    // Try to find the user in both models
    const [user, org] = await Promise.all([
      this.userService.getUserByEmail(email),
      this.userService.getOrgByEmail(email),
    ]);

    if (!user && !org) {
      throw new BadRequestException('Invalid Email');
    }

    if (user?.emailVerified || org?.emailVerified) {
      throw new UnprocessableEntityException('Email already verified');
    }

    // Verify OTP
    await this.otpService.verifyOTP(
      {
        code,
        email,
        type: OtpTypeEnum.VERIFY_EMAIL,
      },
      true,
    );

    // Update emailVerified in the correct document
    if (user) {
      await this.userService.updateQuery({ email }, { emailVerified: true });
    }

    if (org) {
      await this.userService.updateQuery({ email }, { emailVerified: true });
    }

    const recipientName = user?.email || org?.email || 'User';

    await this.mailService.sendEmail(
      email,
      `Welcome To ${ENVIRONMENT.APP.NAME}`,
      welcomeEmailTemplate({
        name: recipientName,
      }),
    );
  }

  async sendVerificationMail(payload: RequestVerifyEmailOtpDto) {
    await this.userService.checkUserExistByEmail(payload.email);

    await this.otpService.sendOTP({
      ...payload,
      type: OtpTypeEnum.VERIFY_EMAIL,
    });
  }

  async sendPasswordResetEmail(payload: ForgotPasswordDto) {
    await this.userService.checkUserExistByEmail(payload.email);

    await this.otpService.sendOTP({
      ...payload,
      type: OtpTypeEnum.RESET_PASSWORD,
    });
  }

  async resetPassword(payload: ResetPasswordDto) {
    const { email, password, confirmPassword, code } = payload;

    if (password !== confirmPassword) {
      throw new ConflictException('Passwords do not match');
    }

    await this.otpService.verifyOTP(
      {
        email,
        code,
        type: OtpTypeEnum.RESET_PASSWORD,
      },
      true,
    );

    const hashedPassword = await BaseHelper.hashData(password);

    await this.userService.updateQuery({ email }, { password: hashedPassword });
  }

  async logout(userId: string): Promise<void> {
    await this.userService.updateQuery({ _id: userId }, { loginToken: null });
  }

  async googleAuth(payload: GoogleAuthDto) {
    const { email } = payload;

    const user = await this.userService.getUserByEmail(email);

    if (user) {
      if (user.authSource !== AuthSourceEnum.GOOGLE) {
        throw new ConflictException(
          'Use your existing login details or choose a different email address to sign up with Google',
        );
      }
      await this.userService.updateUserByEmail(email, {
        isLoggedOut: false,
      });

      const token = this.jwtService.sign({ _id: user._id });
      return { ...user['_doc'], accessToken: token };
    }

    const newUser = await this.userService.createUserFromGoogle(payload);

    const token = this.jwtService.sign({ _id: newUser._id });
    return { ...newUser['_doc'], accessToken: token };
  }

  async generateWalletAuthNonce(
    walletAddress: string,
  ): Promise<{ nonce: string; message: string }> {
    // Check rate limiting
    const rateLimitKey = cacheKeys.walletNonceRateLimit(walletAddress);
    let currentRequests = await CacheHelperUtil.getCache<number>(rateLimitKey);
    const ttl = await CacheHelperUtil.getTtl(rateLimitKey);

    if (currentRequests && ttl <= 0) {
      await CacheHelperUtil.removeFromCache(rateLimitKey);
      currentRequests = 0;
    }

    if (currentRequests && currentRequests >= authConstants.nonceRateLimitMax) {
      throw new BadRequestException(
        `Too many requests. Please try again in ${Math.ceil(ttl)} seconds.`,
        ERROR_CODES.BAD_REQUEST,
      );
    }

    // Generate a nonce
    const nonce = BaseHelper.generateUuid();
    const message = BaseHelper.createSignatureMessage(walletAddress, nonce);

    // Store nonce in Redis with expiration
    const nonceKey = cacheKeys.walletNonce(walletAddress);
    await CacheHelperUtil.setCache(
      nonceKey,
      nonce,
      authConstants.nonceRateLimitWindow,
    );

    // Update rate limiting (preserve existing window)
    const newRateLimit = currentRequests ? currentRequests + 1 : 1;
    const newTtl = !currentRequests ? authConstants.nonceRateLimitWindow : ttl;
    await CacheHelperUtil.setCache(rateLimitKey, newRateLimit, newTtl);

    return {
      nonce,
      message,
    };
  }

  async loginWithWallet(payload: WalletLoginDto) {
    // Verify nonce exists and hasn't expired
    const nonceKey = cacheKeys.walletNonce(payload.walletAddress);
    await CacheHelperUtil.getCache<string>(nonceKey);

    // TODO: ENABLE NONCE CHECKING
    // if (!storedNonce) {
    //   throw new BadRequestException(
    //     'Invalid or expired nonce. Please request a new one.',
    //     ERROR_CODES.UNAUTHORIZED,
    //   );
    // }

    // if (storedNonce !== payload.nonce) {
    //   throw new BadRequestException('Invalid nonce.', ERROR_CODES.UNAUTHORIZED);
    // }

    // // Recreate the message that was signed
    // const message = BaseHelper.createSignatureMessage(
    //   payload.walletAddress,
    //   payload.nonce,
    // );

    // // Verify signature
    // const isValidSignature = BaseHelper.verifyWalletSignature(
    //   message,
    //   payload.signature,
    //   payload.walletAddress,
    // );

    // if (!isValidSignature) {
    //   throw new BadRequestException(
    //     'Invalid wallet signature.',
    //     ERROR_CODES.UNAUTHORIZED,
    //   );
    // }

    // Remove the used nonce immediately
    await CacheHelperUtil.removeFromCache(nonceKey);

    let user = (await this.userService.findOneQuery({
      walletAddress: payload.walletAddress,
    })) as UserDocument;

    const isNewUser = !user;
    const now = new Date();

    if (user) {
      await this.userService.updateQuery(
        { _id: user._id },
        {
          $set: {
            username: payload.username,
            lastLoginAt: now,
            authSource: AuthSourceEnum.WALLET,
          },
        },
      );
    } else {
      user = await this.userService.createWalletUser({
        walletAddress: payload.walletAddress,
        username: payload.username,
        role: payload.role,
      });
    }

    // Generate JWT token
    const token = this.jwtService.sign(
      { _id: user._id, role: user.role },
      {
        secret: ENVIRONMENT.JWT.SECRET,
      },
    );

    return {
      isNewUser,
      token,
      user: {
        _id: user._id,
        walletAddress: user.walletAddress,
        role: user.role,
        profilePhoto: user.profilePhoto,
      },
    };
  }
}
