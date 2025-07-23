import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  // UnprocessableEntityException,
} from '@nestjs/common';
import { User, UserDocument } from '../schemas/user.schema';
import { ClientSession, FilterQuery, Model, UpdateQuery } from 'mongoose';
import {
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
import { AuthSourceEnum } from '../../../../common/enums/user.enum';
import { GoogleAuthDto } from '../../auth/dto/auth.dto';
import { PinataService } from 'src/common/utils/pinata.util';
import { PaginationDto } from '../../repository/dto/repository.dto';
import { RepositoryService } from '../../repository/repository.service';
import { WalletService } from '../../blockchain/services/wallet.service';
import {
  Organization,
  OrganizationDocument,
} from '../schemas/organization.schema';
import {
  OrganizationPost,
  OrganizationPostDocument,
} from '../../organization-post/schema/organization-post.schema';
import { OrganizationVisibilityEnum } from 'src/common/enums/organization.enum';
import { LoggedInUser } from 'src/common/interfaces/user.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
    @InjectModel(OrganizationPost.name)
    private organizationPostModel: Model<OrganizationPostDocument>,
    private otpService: OtpService,
    private pinataService: PinataService,
    private repositoryService: RepositoryService,
    private walletService: WalletService,
  ) {}


  async createUser(payload: CreateUserDto) {
    try {
      const { referralCode, role } = payload;

      if (!payload.termsAndConditionsAccepted) {
        throw new BadRequestException('Please accept terms and conditions');
      }

      const isOrganization = role === UserRoleEnum.ORGANIZATION;

      const modelToCheck = isOrganization
        ? this.organizationModel
        : this.userModel;

      const [emailExists, phoneExists] = await Promise.all([
        modelToCheck.exists({ email: payload.email }),
        modelToCheck.exists({ phone: payload.phone }),
      ]);

      if (emailExists) {
        throw new BadRequestException('User with this email already exists');
      }

      if (phoneExists) {
        throw new BadRequestException('User with this phone already exists');
      }

      delete payload.referralCode;

      let referralUserId: string;
      if (referralCode && !isOrganization) {
        const referralUser = await this.userModel.findOne({ referralCode });

        if (!referralUser) {
          throw new BadRequestException('Referral code is invalid');
        }

        referralUserId = referralUser._id.toString();
      }

      const hashedPassword = await BaseHelper.hashData(payload.password);
      const userReferralCode = await BaseHelper.generateReferenceCode();
      const createWallet = await this.walletService.createWallet();

      const commonData = {
        ...payload,
        password: hashedPassword,

        role: role,
        referredBy: referralUserId,

        referralCode: userReferralCode,
        walletAddress: createWallet.walletAddress,
      };

      if (!isOrganization) {
        commonData['referredBy'] = referralUserId;
      }

      const createdEntity = isOrganization
        ? await new this.organizationModel(commonData).save()
        : await new this.userModel(commonData).save();

      if (referralUserId) {
        await this.userModel.updateOne(
          { _id: referralUserId },
          { $inc: { totalReferrals: 1 } },
        );
      }

      delete createdEntity['_doc'].password;

      return {
        user: createdEntity,
        walletDetails: {
          walletAddress: createWallet.walletAddress,
          privateKey: createWallet.privateKey,
          accountAddress: createWallet.accountAddress,
          transactionId: createWallet.transactionId,
        },
      };
    } catch (e) {
      console.error('Error while creating user/organization', e);
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

  async getOrgDetailsWithPassword(
    query: FilterQuery<OrganizationDocument>,
  ): Promise<OrganizationDocument> {
    return this.organizationModel.findOne(query).select('+password');
  }

  async getCurrentUserProfile(
    id: string,
    populateFields?: string,
  ): Promise<UserDocument | OrganizationDocument | null> {
    const [user, org] = await Promise.all([
      this.userModel.findOne({ _id: id }).populate(populateFields),
      this.organizationModel.findOne({ _id: id }).populate(populateFields),
    ]);

    return user || org;
  }

  async getUserById(
    id: string,
    populateFields?: string,
  ): Promise<UserDocument> {
    return this.userModel.findOne({ _id: id }).populate(populateFields);
  }

  async getOrgById(
    id: string,
    populateFields?: string,
  ): Promise<OrganizationDocument> {
    return this.organizationModel.findOne({ _id: id }).populate(populateFields);
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

  async getOrgByEmail(
    email: string,
    populateFields?: string,
  ): Promise<OrganizationDocument> {
    return this.organizationModel.findOne({ email }).populate(populateFields);
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

  async updateOrgQuery(
    filter: FilterQuery<OrganizationDocument>,
    payload: UpdateQuery<OrganizationDocument>,
    session?: ClientSession,
  ): Promise<OrganizationDocument> {
    const updatedUser = await this.organizationModel.findOneAndUpdate(
      filter,
      payload,
      {
        session,
      },
    );

    return updatedUser;
  }

  async updateUsersQuery(
    filter: FilterQuery<any>,
    payload: UpdateQuery<any>,
    session?: ClientSession,
  ): Promise<any> {
    let model: Model<any> | null = null;

    const user = await this.userModel.findOne(filter);
    if (user) model = this.userModel;

    const org = !user ? await this.organizationModel.findOne(filter) : null;
    if (org) model = this.organizationModel;

    if (!model) {
      throw new NotFoundException('No matching user or organization');
    }

    return await model.findOneAndUpdate(filter, payload, {
      new: true,
      session,
    });
  }

  async deleteUser(id: string) {
    return this.userModel.findByIdAndDelete(id);
  }

  async checkUserExistByEmail(email: string): Promise<boolean> {
    const [user, org] = await Promise.all([
      this.getUserByEmail(email),
      this.getOrgByEmail(email),
    ]);

    if (!user || !org) {
      throw new BadRequestException('No user exist with provided email');
    }

    return true;
  }

  async changeEmail(payload: ChangeEmailDto, user: LoggedInUser) {
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

  // async updatePassword(user: UserDocument, payload: UpdatePasswordDto) {
  //   const { password, newPassword, confirmPassword } = payload;

  //   if (newPassword !== confirmPassword) {
  //     throw new BadRequestException(
  //       'new password and confirm password do not match',
  //     );
  //   }

  //   if (password === newPassword) {
  //     throw new BadRequestException(
  //       'new password cannot be same as old password',
  //     );
  //   }

  //   const oldPasswordMatch = await BaseHelper.compareHashedData(
  //     password,
  //     (await this.getUserDetailsWithPassword({ email: user.email })).password,
  //   );

  //   if (!oldPasswordMatch) {
  //     throw new BadRequestException('Incorrect Password');
  //   }

  //   const hashedPassword = await BaseHelper.hashData(newPassword);

  //   await this.updateQuery({ _id: user._id }, { password: hashedPassword });
  // }

  async updatePassword(user: LoggedInUser, payload: UpdatePasswordDto) {
    const { password, newPassword, confirmPassword } = payload;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    if (password === newPassword) {
      throw new BadRequestException(
        'New password cannot be same as old password',
      );
    }

    let existingPassword: string;

    if (user.role === UserRoleEnum.TALENT) {
      const talent = await this.getUserDetailsWithPassword({
        email: user.email,
      });
      existingPassword = talent.password;
    } else if (user.role === UserRoleEnum.ORGANIZATION) {
      const organization = await this.organizationModel
        .findOne({ email: user.email })
        .select('+password')
        .lean();

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      existingPassword = organization.password;
    } else {
      throw new BadRequestException('Invalid user role');
    }

    const oldPasswordMatch = await BaseHelper.compareHashedData(
      password,
      existingPassword,
    );

    if (!oldPasswordMatch) {
      throw new BadRequestException('Incorrect current password');
    }

    const hashedPassword = await BaseHelper.hashData(newPassword);

    if (user.role === UserRoleEnum.TALENT) {
      await this.updateQuery({ _id: user._id }, { password: hashedPassword });
    } else {
      await this.organizationModel.updateOne(
        { _id: user._id },
        { password: hashedPassword },
      );
    }
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
    user: OrganizationDocument,
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

    return await this.organizationModel.findByIdAndUpdate(
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

  // async aggregateUserStats() {
  //   return await this.userModel.aggregate([
  //     {
  //       $match: { isDeleted: { $ne: true } },
  //     },
  //     {
  //       $group: {
  //         _id: '$role',
  //         count: { $sum: 1 },
  //       },
  //     },
  //   ]);
  // }

  async aggregateUserStats() {
    const userStats = await this.userModel.aggregate([
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

    const organizationStats = await this.organizationModel.aggregate([
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

    return { userStats, organizationStats };
  }

  async update(
    userId: string,
    payload: UpdateQuery<UserDocument>,
  ): Promise<UserDocument> {
    return await this.userModel.findOneAndUpdate({ _id: userId }, payload, {
      new: true,
    });
  }

  async updateOrgDetails(
    userId: string,
    payload: UpdateQuery<OrganizationDocument>,
  ): Promise<OrganizationDocument> {
    return await this.organizationModel.findOneAndUpdate(
      { _id: userId },
      payload,
      {
        new: true,
      },
    );
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

  // async deleteUser(organization: UserDocument) {
  //   const deletedPost = await this.userModel.findOneAndUpdate(
  //     {
  //       user: organization._id,
  //       isDeleted: { $ne: true },
  //     },
  //     { isDeleted: true },
  //     { new: true },
  //   );

  //   if (!deletedPost) {
  //     throw new NotFoundException(' User not found or already deleted');
  //   }

  //   return {
  //     message: 'User deleted successfully',
  //     // data: deletedPost,
  //   };
  // }

  // async getTopSkillsInDemand(organizationId: string) {
  //   const pipeline = [
  //     {
  //       $match: {
  //         organization: new Types.ObjectId(organizationId),
  //         isDeleted: { $ne: true },
  //       },
  //     },
  //     {
  //       $unwind: {
  //         path: '$requiredSkills',
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: '$requiredSkills',
  //         count: { $sum: 1 },
  //       },
  //     },
  //     {
  //       $sort: {
  //         count: -1,
  //       } as any,
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         skills: {
  //           $push: {
  //             skill: '$_id',
  //             count: '$count',
  //           },
  //         },
  //         maxCount: { $first: '$count' },
  //       },
  //     },
  //     {
  //       $unwind: {
  //         path: '$skills',
  //       },
  //     },
  //     {
  //       $project: {
  //         _id: 0,
  //         skill: '$skills.skill',
  //         count: '$skills.count',
  //         demandRate: {
  //           $multiply: [{ $divide: ['$skills.count', '$maxCount'] }, 100],
  //         },
  //       },
  //     },
  //     {
  //       $sort: {
  //         count: -1,
  //       } as any,
  //     },
  //   ];

  //   return this.organizationPostModel.aggregate(pipeline);
  // }

  async updateOrganizationUserVisibility(
    orgId: string,
    visibility: OrganizationVisibilityEnum,
  ): Promise<OrganizationDocument> {
    const updated = await this.organizationModel.findByIdAndUpdate(
      orgId,
      { $set: { visibility } },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Organization not found');
    }

    return updated;
  }

  async deleteOrganizationUser(orgId: string): Promise<{ message: string }> {
    const session = await this.organizationModel.db.startSession();
    session.startTransaction();

    try {
      const org = await this.organizationModel.findByIdAndUpdate(
        orgId,
        { $set: { isDeleted: true } },
        { new: true, session },
      );

      if (!org) throw new NotFoundException('Organization not found');

      await this.organizationPostModel.updateMany(
        { organization: orgId },
        { $set: { isDeleted: true } },
        { session },
      );

      await session.commitTransaction();
      return { message: 'Organization and its job posts deleted successfully' };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
