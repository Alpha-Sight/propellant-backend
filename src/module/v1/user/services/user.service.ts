import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { User, UserDocument } from '../schemas/user.schema';
import { ClientSession, FilterQuery, Model, UpdateQuery } from 'mongoose';
import {
  ChangeEmailDto,
  CreateOrganizationDto,
  CreateUserDto,
  CreateWalletUserDto,
  UpdatePasswordDto,
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
// import { PinataUploadFile } from 'src/common/interfaces/pinata.interface';
// import { PinataService } from 'src/common/utils/pinata.util';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private otpService: OtpService,
    // private pinataService: PinataService,
  ) {}

  async createUser(
    payload: CreateUserDto | CreateOrganizationDto,
    role?: UserRoleEnum,
  ): Promise<UserDocument> {
    try {
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

      const hashedPassword = await BaseHelper.hashData(payload.password);

      let userRole = role ?? UserRoleEnum.TALENT;
      if (payload instanceof CreateOrganizationDto) {
        userRole = UserRoleEnum.ORGANIZATION;
      }

      const createdUser = await this.userModel.create({
        ...payload,
        password: hashedPassword,
        role: userRole,
      });

      delete createdUser['_doc'].password;
      return createdUser;
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

  // async updateProfile(
  //   userId: string,
  //   payload: UpdateProfileDto,
  //   file?: Express.Multer.File,
  // ) {
  //   const { username } = payload;

  //   if (username) {
  //     const userWithUsernameExist = await this.userModel.findOne({
  //       username,
  //       _id: { $ne: userId },
  //     });

  //     if (userWithUsernameExist) {
  //       throw new UnprocessableEntityException(
  //         'Username already used, try another name',
  //       );
  //     }
  //   }

  //   let imageUrl = null;

  //   if (file) {
  //     const { mimetype, buffer } = file;

  //     const pinataFile: PinataUploadFile = {
  //       fileName: BaseHelper.generateFileName('user', mimetype),
  //       mimetype,
  //       buffer,
  //     };

  //     const uploadResult = await this.pinataService.uploadFile(pinataFile);
  //     imageUrl = uploadResult.secretUrl.toString();
  //   }

  //   return await this.userModel.findByIdAndUpdate(
  //     userId,
  //     { ...payload, ...(imageUrl && { imageUrl }) },
  //     {
  //       new: true,
  //     },
  //   );
  // }
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
}
