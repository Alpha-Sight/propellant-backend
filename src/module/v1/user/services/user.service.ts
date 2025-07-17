import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  // UnprocessableEntityException,
} from '@nestjs/common';
import { User, UserDocument } from '../schemas/user.schema';
import { ClientSession, FilterQuery, Model, UpdateQuery } from 'mongoose';
import {
  ChangeEmailDto,
  CreateOrganizationDto,
  CreateUserDto,
  CreateWalletUserDto,
  UpdateOrganizationProfileDto,
  UpdatePasswordDto,
  UpdateTalentProfileDto,
  // UpdateProfileDto,
  UserAvailabilityDto,
} from '../dto/user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { BaseHelper } from '../../../../common/utils/helper/helper.util';
import { OtpTypeEnum } from '../../../../common/enums/otp.enum';
import { OtpService } from '../../otp/services/otp.service';
import {
  AuthSourceEnum,
  UserRoleEnum,
} from '../../../../common/enums/user.enum';
import { GoogleAuthDto } from '../../auth/dto/auth.dto';
import { PinataService } from 'src/common/utils/pinata.util';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { RepositoryService } from '../../repository/repository.service';
import { WalletService } from '../../blockchain/services/wallet.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private otpService: OtpService,
    private pinataService: PinataService,
    private repositoryService: RepositoryService,
    private walletService: WalletService,
  ) {}

  async createUser(
    payload: CreateUserDto | CreateOrganizationDto,
    role?: UserRoleEnum,
  ) {
    try {
      const { referralCode } = payload;

      if (!payload.termsAndConditionsAccepted) {
        throw new BadRequestException('Please accept terms and conditions');
      }

      const [userWithEmailExists, userWithPhoneExists] = await Promise.all([
        this.userModel.exists({ email: payload.email }),
        this.userModel.exists({ phone: payload.phone }),
      ]);

      if (userWithEmailExists) {
        throw new BadRequestException('User with this email already exists');
      }

      if (userWithPhoneExists) {
        throw new BadRequestException('User with this phone already exists');
      }

      delete payload.referralCode; // delete the referral code to prevent persisting this as the new user referral code

      let referralUserId: string;
      if (referralCode) {
        const referralUser = await this.userModel.findOne({ referralCode });

        if (!referralUser) {
          throw new BadRequestException('Referral code is invalid');
        }

        referralUserId = referralUser._id.toString();
      }

      const hashedPassword = await BaseHelper.hashData(payload.password);

      let userRole = role ?? UserRoleEnum.TALENT;
      if (payload instanceof CreateOrganizationDto) {
        userRole = UserRoleEnum.ORGANIZATION;
      }

      // Generate unique referral code for the new user
      const userReferralCode = await BaseHelper.generateReferenceCode();

      // this.logger.log(`Creating wallet for user`);
      const createWallet = await this.walletService.createWallet();

      const createdUser = await this.userModel.create({
        ...payload,
        password: hashedPassword,
        role: userRole,
        referredBy: referralUserId,
        referralCode: userReferralCode,
        walletAddress: createWallet.walletAddress,
      });

      // update referral user referral count
      // TODO: award referral point
      if (referralUserId) {
        await this.userModel.updateOne(
          { _id: referralUserId },
          {
            $inc: {
              totalReferrals: 1,
            },
          },
        );
      }
      // update user referral code

      // TODO: not important but we can send an email or push notification to notify user of new referral

      delete createdUser['_doc'].password;
      return {
        user: createdUser,
        walletDetails: {
          walletAddress: createWallet.walletAddress,
          privateKey: createWallet.privateKey,
          accountAddress: createWallet.accountAddress,
          transactionId: createWallet.transactionId,
        },
      };
    } catch (e) {
      console.error('Error while creating user', e);
      if (e.code === 11000) {
        throw new ConflictException(
          `${Object.keys(e.keyValue)} already exists`,
        );
      } else {
        throw new InternalServerErrorException(
          e.response?.message || 'Something went wrong',
        );
      }
    }
  }

  async getUserDetailsWithPassword(
    query: FilterQuery<UserDocument>,
  ): Promise<UserDocument> {
    return this.userModel.findOne(query).select('+password');
  }

  async getUserById(
    id: string,
    populateFields?: string,
  ): Promise<UserDocument> {
    return this.userModel.findOne({ _id: id }).populate(populateFields);
  }

  async getUserByEmail(
    email: string,
    populateFields?: string,
  ): Promise<UserDocument> {
    return this.userModel.findOne({ email }).populate(populateFields);
  }

  async updateUserByEmail(email: string, details: any) {
    return this.userModel.updateOne({ email }, details);
  }

  async getUserByPhoneNumber(
    phone: string,
    populateFields?: string,
  ): Promise<UserDocument> {
    return this.userModel.findOne({ phone }).populate(populateFields);
  }

  async updateQuery(
    filter: FilterQuery<UserDocument>,
    payload: UpdateQuery<UserDocument>,
    session?: ClientSession,
  ): Promise<UserDocument> {
    const updatedUser = await this.userModel.findOneAndUpdate(filter, payload, {
      session,
    });

    return updatedUser;
  }

  async deleteUser(id: string) {
    return this.userModel.findByIdAndDelete(id);
  }

  async checkUserExistByEmail(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);

    if (!user) {
      throw new BadRequestException('No user exist with provided email');
    }

    return true;
  }

  async changeEmail(payload: ChangeEmailDto, user: UserDocument) {
    const { newEmail } = payload;

    if (user.email === newEmail) {
      throw new BadRequestException(
        'New email cannot be same as current email',
      );
    }

    const userWithSameEmail = await this.getUserByEmail(newEmail);

    if (userWithSameEmail) {
      throw new BadRequestException('A user already exist with provided email');
    }

    await this.updateQuery(
      { _id: user._id },
      { email: newEmail, emailVerified: false },
    );

    await this.otpService.sendOTP({
      email: newEmail,
      type: OtpTypeEnum.VERIFY_EMAIL,
    });
  }

  async updatePassword(user: UserDocument, payload: UpdatePasswordDto) {
    const { password, newPassword, confirmPassword } = payload;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'new password and confirm password do not match',
      );
    }

    if (password === newPassword) {
      throw new BadRequestException(
        'new password cannot be same as old password',
      );
    }

    const oldPasswordMatch = await BaseHelper.compareHashedData(
      password,
      (await this.getUserDetailsWithPassword({ email: user.email })).password,
    );

    if (!oldPasswordMatch) {
      throw new BadRequestException('Incorrect Password');
    }

    const hashedPassword = await BaseHelper.hashData(newPassword);

    await this.updateQuery({ _id: user._id }, { password: hashedPassword });
  }

  async findOneById(userId: string) {
    return this.userModel.findById(userId);
  }

  async updateTalentProfile(
    user: UserDocument,
    payload: UpdateTalentProfileDto,
    file?: Express.Multer.File,
  ) {
    // const { username } = payload;

    // if (username) {
    //   const userWithUsernameExist = await this.userModel.findOne({
    //     username,
    //     _id: { $ne: user._id },
    //   });

    //   if (userWithUsernameExist) {
    //     throw new UnprocessableEntityException(
    //       'Username already used, try another name',
    //     );
    //   }
    // }

    let imageUrl = null;

    if (file) {
      // const { mimetype, buffer } = file;

      // const pinataFile: PinataUploadFile = {
      //   fileName: BaseHelper.generateFileName('profileImage', mimetype),
      //   mimetype,
      //   buffer,
      // };

      const uploadResult = await this.pinataService.uploadFile(file);
      imageUrl = uploadResult;
    }

    const updateData = {
      ...payload,
      // ...(username && { referralCode: username }),
    };

    // if (!user?.referralCode) {
    //   updateData['referralCode'] = user?.username;
    // }

    return await this.userModel.findByIdAndUpdate(
      user._id,
      { ...payload, ...(imageUrl && { imageUrl }), ...updateData },
      {
        new: true,
      },
    );
  }

  async updateOrganizationProfile(
    user: UserDocument,
    payload: UpdateOrganizationProfileDto,
    file?: Express.Multer.File,
  ) {
    let imageUrl = null;

    if (file) {
      const uploadResult = await this.pinataService.uploadFile(file);
      imageUrl = uploadResult;
    }

    const updateData = {
      ...payload,
    };

    return await this.userModel.findByIdAndUpdate(
      user._id,
      { ...payload, ...(imageUrl && { imageUrl }), ...updateData },
      {
        new: true,
      },
    );
  }

  async findOneQuery(query: FilterQuery<UserDocument>) {
    return await this.userModel.findOne(query);
  }

  async checkPhoneOrEmailExists(payload: UserAvailabilityDto) {
    const { email, phone } = payload;

    const [emailExists, phoneExists] = await Promise.all([
      email ? this.userModel.exists({ email }) : false,
      phone ? this.userModel.exists({ phone: `+${phone}` }) : false,
    ]);

    return {
      email: !!emailExists,
      phone: !!phoneExists,
    };
  }

  async aggregateUserStats() {
    return await this.userModel.aggregate([
      {
        $match: { isDeleted: { $ne: true } },
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async update(
    userId: string,
    payload: UpdateQuery<UserDocument>,
  ): Promise<UserDocument> {
    return await this.userModel.findOneAndUpdate({ _id: userId }, payload, {
      new: true,
    });
  }

  async createUserFromGoogle(payload: GoogleAuthDto) {
    return await this.userModel.create({
      ...payload,
      authSource: AuthSourceEnum.GOOGLE,
      isLoggedOut: false,
    });
  }

  async createWalletUser(payload: CreateWalletUserDto): Promise<UserDocument> {
    const newUser = await this.userModel.create({
      walletAddress: payload.walletAddress,
      username: payload.username,
      role: payload.role,
      authSource: AuthSourceEnum.WALLET,
    });

    return newUser;
  }

  async checkProfileCompletion(userData: any) {
    const requiredBasicFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'professionalTitle',
      'professionalSummary',
    ];

    const basicFieldsComplete = requiredBasicFields.every(
      (field) => userData[field] && userData[field].toString().trim() !== '',
    );

    const hasExperience = userData.experience && userData.experience.length > 0;

    const hasSkills = userData.skills && userData.skills.length > 0;

    const hasEducation = userData.education && userData.education.length > 0;

    return basicFieldsComplete && hasExperience && hasSkills && hasEducation;
  }

  async showUserReferrals(user: UserDocument, query: PaginationDto) {
    return this.repositoryService.paginate({
      model: this.userModel,
      query,
      options: {
        _id: { $ne: user._id },
        referredBy: user._id,
      },
    });
  }
}
