import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  // UnprocessableEntityException,
} from '@nestjs/common';
import { User, UserDocument } from '../schemas/user.schema';
import {
  ClientSession,
  FilterQuery,
  Model,
  Types,
  UpdateQuery,
} from 'mongoose';
import {
  AdminGetAllUsersDto,
  ChangeEmailDto,
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
  UserVisibilityEnum,
} from '../../../../common/enums/user.enum';
import { GoogleAuthDto } from '../../auth/dto/auth.dto';
import { PinataService } from 'src/common/utils/pinata.util';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { RepositoryService } from '../../repository/repository.service';
import { WalletService } from '../../blockchain/services/wallet.service';
import {
  OrganizationPost,
  OrganizationPostDocument,
} from '../../organization-post/schema/organization-post.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(OrganizationPost.name)
    private organizationPostModel: Model<OrganizationPostDocument>,
    private otpService: OtpService,
    private pinataService: PinataService,
    private repositoryService: RepositoryService,
    private walletService: WalletService,
  ) {}

  async findById(userId: string): Promise<UserDocument | null> {
    return await this.userModel.findById(userId);
  }

  async createUser(payload: CreateUserDto) {
    try {
      const { referralCode, role } = payload;

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
      const userReferralCode = await BaseHelper.generateReferenceCode();

      // this.logger.log(`Creating wallet for user`);
      const createWallet = await this.walletService.createWallet();

      const roleDefaults =
        role === UserRoleEnum.TALENT
          ? {
              totalReferrals: 0,
              totalCreditPoint: 0,
              totalReferralPoint: 0,
              totalCredentialUploads: 0,
              totalCvDownload: 0,
              isReferralBonusClaimed: false,
              referredBy: null,
              skills: [],
            }
          : {
              totalJobPost: 0,
              activePost: 0,
              activeConversations: 0,
              offers: [],
              socials: [],
              talentContacted: 0,
              successfulHire: 0,
              responseRate: 0,
            };

      const createdUser = await this.userModel.create({
        ...payload,
        ...roleDefaults,
        password: hashedPassword,
        role: role,
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

  async getUserBySkills(skills: string[]): Promise<UserDocument[]> {
    return this.userModel.find({
      role: UserRoleEnum.TALENT,
      isDeleted: false,
      skills: { $in: skills },
    });
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

  async updateProfile(
    user: UserDocument,
    payload: UpdateTalentProfileDto | UpdateOrganizationProfileDto,
    file?: Express.Multer.File,
  ) {
    let imageUrl = null;

    if (file) {
      // const { mimetype, buffer } = file;

      // const pinataFile: PinataUploadFile = {
      //   fileName: BaseHelper.generateFileName('profileImage', mimetype),
      //   mimetype,
      //   buffer,
      // };

      const uploadResult = await this.pinataService.uploadFile(
        file,
        'profileImage',
      );
      imageUrl = uploadResult;
    }

    const updateData =
      user.role === UserRoleEnum.TALENT
        ? (payload as UpdateTalentProfileDto)
        : (payload as UpdateOrganizationProfileDto);

    return await this.userModel.findByIdAndUpdate(
      user._id,
      { ...(imageUrl && { imageUrl }), ...updateData },
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

  async getTopSkillsInDemand(organizationId: string) {
    const pipeline = [
      {
        $match: {
          organization: new Types.ObjectId(organizationId),
          isDeleted: { $ne: true },
        },
      },
      {
        $unwind: {
          path: '$requiredSkills',
        },
      },
      {
        $group: {
          _id: '$requiredSkills',
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        } as any,
      },
      {
        $group: {
          _id: null,
          skills: {
            $push: {
              skill: '$_id',
              count: '$count',
            },
          },
          maxCount: { $first: '$count' },
        },
      },
      {
        $unwind: {
          path: '$skills',
        },
      },
      {
        $project: {
          _id: 0,
          skill: '$skills.skill',
          count: '$skills.count',
          demandRate: {
            $multiply: [{ $divide: ['$skills.count', '$maxCount'] }, 100],
          },
        },
      },
      {
        $sort: {
          count: -1,
        } as any,
      },
    ];

    return this.organizationPostModel.aggregate(pipeline);
  }

  async updateUserVisibility(
    user: UserDocument,
    visibility: UserVisibilityEnum,
  ): Promise<UserDocument> {
    const updated = await this.userModel.findByIdAndUpdate(
      user._id,
      { $set: { visibility } },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Organization not found');
    }

    return updated;
  }

  async deleteUserProfile(user: UserDocument): Promise<{ message: string }> {
    const session = await this.userModel.db.startSession();
    session.startTransaction();

    try {
      const updatedUser = await this.userModel.findByIdAndUpdate(
        user._id,
        { $set: { isDeleted: true } },
        { new: true, session },
      );

      if (!updatedUser) throw new NotFoundException('User not found');

      await this.organizationPostModel.updateMany(
        { organization: user._id },
        { $set: { isDeleted: true } },
        { session },
      );

      await session.commitTransaction();
      return { message: 'User deleted successfully' };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async getUserReferrals(user: UserDocument, query: AdminGetAllUsersDto) {
    const { isDeleted, userId, ...paginationQuery } = query;

    const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPER_ADMIN].includes(
      user.role,
    );

    if (!isAdmin && userId) {
      throw new ForbiddenException(
        'You are not allowed to fetch referrals for other users',
      );
    }

    // If admin provided a userId, use it. Otherwise, use the logged-in user's ID
    const targetUserId = isAdmin && userId ? userId : user._id;

    return await this.repositoryService.paginate<UserDocument>({
      model: this.userModel,
      query: paginationQuery,
      options: {
        ...(isDeleted && { isDeleted }),
        referredBy: targetUserId,
      },
      ...paginationQuery,
    });
  }
}
