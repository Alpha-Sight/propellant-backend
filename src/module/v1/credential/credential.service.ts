import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CredentialCategoryEnum,
  CredentialStatusEnum,
  CredentialTypeEnum,
} from '../../../common/enums/credential.enum';
import { RepositoryService } from '../repository/repository.service';
import {
  TalentCredentialDocument,
  TalentCredential,
} from './schema/credential.schema';
import { UserDocument } from '../user/schemas/user.schema';
import {
  UploadCredentialDto,
  GetAllCredentialsDto,
  UpdateCredentialDto,
  CredentialResponseDto,
  PaginatedCredentialResponse,
} from './dto/credential.dto';
import { PaginationDto } from '../repository/dto/repository.dto';
import { PinataService } from 'src/common/utils/pinata.util';
import { SubscriptionTypeEnum } from 'src/common/enums/premium.enum';
import { UserService } from '../user/services/user.service';
import { MailService } from '../mail/mail.service';
import { CredentialVerificationRequestTemplate } from '../mail/templates/credential-verification-request.email';
import { CredentialDocument } from '../blockchain/schemas/credential.schema';

@Injectable()
export class CredentialService {
  constructor(
    @InjectModel(TalentCredential.name)
    private credentialModel: Model<TalentCredentialDocument>,
    private repositoryService: RepositoryService,
    private pinataService: PinataService,
    private userService: UserService,
    private mailService: MailService,
  ) {}

  async uploadCredential(
    user: UserDocument,
    payload: UploadCredentialDto,
    file: Express.Multer.File,
  ): Promise<CredentialResponseDto> {
    try {
      if (!user || !user._id) {
        throw new BadRequestException('User not found or invalid');
      }
      if (
        user.plan === SubscriptionTypeEnum.FREE &&
        user.totalCredentialUploads >= 100
      )
        throw new BadRequestException(
          ' you’re limited to one credential upload per month. Upgrade your plan to enjoy unlimited uploads.',
        );
      if (!file) {
        throw new BadRequestException('File not Found');
      }
      const ipfsHash = await this.pinataService.uploadFile(file, 'credential');

      // Set defaults for required fields
      const now = new Date();
      // Convert credentialType to number if it's an enum string
      let credentialTypeValue = payload.type;
      if (typeof credentialTypeValue === 'string') {
        // Map string to number if needed (update this mapping as per your enum)
        const typeMap = {
          DEGREE: 0,
          CERTIFICATE: 1,
          LICENSE: 2,
          AWARD: 3,
          TRAINING: 4,
          WORK_EXPERIENCE: 5,
          PROJECT_PORTFOLIO: 6,
          RECOMMENDATION_LETTER: 7,
          OTHER: 8,
        };
        credentialTypeValue = typeMap[payload.type] ?? (8 as any);
      }

      const credentialData = {
        credentialId: `${user._id}-${now.getTime()}`,
        subject: user._id.toString(),
        issuer: user._id,
        name: payload.title,
        description: payload.description || '',
        credentialType: credentialTypeValue,
        evidenceHash: ipfsHash,
        revocable: true,
        status: 'PENDING',
        createdAt: now,
        // Additional fields for the newer schema compatibility
        user: user._id,
        title: payload.title,
        type: payload.type,
        category: payload.category,
        externalUrl: payload.externalUrl,
        visibility:
          payload.visibility !== undefined ? payload.visibility : true,
        ipfsHash,
        issuingOrganization: payload.issuingOrganization,
        verifyingOrganization: payload.verifyingOrganization,
        verifyingEmail: payload.verifyingEmail,
        message: payload.message,
        issueDate: payload.issueDate,
        expiryDate: payload.expiryDate,
      };

      const created = await this.credentialModel.create(credentialData);
      const obj =
        typeof created.toObject === 'function' ? created.toObject() : created;

      // Format response to match frontend expectations
      const response: CredentialResponseDto = {
        _id: obj._id.toString(),
        credentialId: obj.credentialId || `${user._id}-${Date.now()}`,
        title: obj.title || payload.title,
        description: obj.description || payload.description,
        type: obj.type || payload.type,
        category: obj.category || payload.category,
        issuer: obj.issuingOrganization || payload.issuingOrganization,
        issueDate: obj.issueDate || payload.issueDate,
        expiryDate: obj.expiryDate || payload.expiryDate,
        verifyingOrganization:
          obj.verifyingOrganization || payload.verifyingOrganization,
        verifyingEmail: obj.verifyingEmail || payload.verifyingEmail,
        message: obj.message || payload.message,
        externalUrl: obj.externalUrl || payload.externalUrl,
        visibility: obj.visibility !== undefined ? obj.visibility : true,
        status: obj.verificationStatus || 'PENDING',
        imageUrl: obj.evidenceHash
          ? `https://gateway.pinata.cloud/ipfs/${obj.evidenceHash}`
          : null,
        createdAt: obj.createdAt?.toISOString() || new Date().toISOString(),
        reviewedAt: obj.reviewedAt?.toISOString() || null,

        // Keep backward compatibility fields
        subject: obj.subject,
        evidenceHash: obj.evidenceHash,
        updatedAt: obj.updatedAt || new Date(),
        ipfsHash: obj.ipfsHash,
        issuingOrganization: obj.issuingOrganization,
      };

      await this.userService.update(user._id.toString(), {
        $inc: { totalCredentialUploads: 1 },
      });

      // Send verification email if verifyingEmail is provided
      if (payload.verifyingEmail && payload.verifyingOrganization) {
        const emailHtml = CredentialVerificationRequestTemplate({
          verifyingOrganization: payload.verifyingOrganization,
          verifyingEmail: payload.verifyingEmail,
          issuingOrganization: payload.issuingOrganization,
          credentialTitle: payload.title,
          userName: user.fullname,
          message: payload.message,
          issueDate: payload.issueDate,
          expiryDate: payload.expiryDate,
          url: payload.externalUrl,
        });
        await this.mailService.sendEmail(
          payload.verifyingEmail,
          `Credential Verification Request: ${payload.title}`,
          emailHtml,
        );
      }
      return response;
    } catch (error) {
      throw new Error(
        `Failed to create credential with IPFS: ${error.message}`,
      );
    }
  }

  async adminGetAllCredentials(query: GetAllCredentialsDto) {
    const {
      type,
      verificationStatus,
      verificationLevel,
      category,
      visibility,
      ...paginationQuery
    } = query;

    return await this.repositoryService.paginate<TalentCredentialDocument>({
      model: this.credentialModel,
      query: paginationQuery,
      options: {
        isDeleted: { $ne: true },
        ...(type && { type }),
        ...(verificationStatus && { verificationStatus }),
        ...(verificationLevel && { verificationLevel }),
        ...(category && { category: { $regex: category, $options: 'i' } }),
        ...(visibility !== undefined && { visibility }),
      },
    });
  }

  async updateCredential(
    _id: string,
    user: UserDocument,
    payload: UpdateCredentialDto,
    file?: Express.Multer.File,
  ): Promise<TalentCredentialDocument> {
    const { ...updateFields } = payload;

    const existingCredential = await this.credentialModel.findOne({
      _id: _id,
      issuer: user._id,
    });

    if (!existingCredential) {
      throw new NotFoundException('No Credential Found');
    }

    // If a new file is provided, unpin the old one and upload the new file
    if (file) {
      if (existingCredential.ipfsHash) {
        await this.pinataService.unpinFile(existingCredential.ipfsHash);
      }

      const newIpfsHash = await this.pinataService.uploadFile(
        file,
        'credential',
      );
      existingCredential.ipfsHash = newIpfsHash;
    }

    const updatedCredential = await this.credentialModel.findByIdAndUpdate(
      _id,
      { ...updateFields },
      { new: true },
    );

    return updatedCredential;
  }

  async getCredentialById(
    credentialId: string,
  ): Promise<CredentialResponseDto> {
    const credential = await this.credentialModel.findOne({
      _id: credentialId,
      isDeleted: { $ne: true },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    const obj =
      typeof credential.toObject === 'function'
        ? credential.toObject()
        : credential;

    // Format response to match frontend expectations
    const response: CredentialResponseDto = {
      _id: obj._id.toString(),
      credentialId: obj.credentialId || `${obj._id}-${Date.now()}`,
      title: obj.title,
      description: obj.description,
      type: obj.type,
      category: obj.category,
      issuer: obj.issuingOrganization,
      issueDate: obj.issueDate,
      expiryDate: obj.expiryDate,
      verifyingOrganization: obj.verifyingOrganization,
      verifyingEmail: obj.verifyingEmail,
      message: obj.message,
      externalUrl: obj.externalUrl,
      visibility: typeof obj.visibility === 'boolean' ? obj.visibility : true,
      status: obj.verificationStatus || 'PENDING',
      imageUrl: obj.evidenceHash
        ? `https://gateway.pinata.cloud/ipfs/${obj.evidenceHash}`
        : null,
      createdAt: obj.createdAt?.toISOString() || new Date().toISOString(),
      reviewedAt: obj.reviewedAt?.toISOString() || null,

      // Keep backward compatibility fields
      subject: obj.subject,
      credentialType: obj.credentialType,
      evidenceHash: obj.evidenceHash,
      revocable: obj.revocable,
      updatedAt: obj.updatedAt || new Date(),
      ipfsHash: obj.ipfsHash,
      issuingOrganization: obj.issuingOrganization,
    };

    return response;
  }

  async deleteCredential(
    user: UserDocument,
    credentialId: string,
  ): Promise<void> {
    try {
      const credential = await this.credentialModel.findOne({
        _id: credentialId,
        issuer: user._id,
      });

      if (!credential) {
        throw new NotFoundException(
          'Credential not found or it does not belong to this user',
        );
      }

      // Soft delete the credential
      await this.credentialModel.findOneAndUpdate(
        { _id: credentialId },
        { isDeleted: true },
      );
      await this.userService.update(user._id.toString(), {
        $inc: { totalCredentialUploads: -1 },
      });
      // Unpin from IPFS if it exists
      if (credential.ipfsHash) {
        await this.pinataService.unpinFile(credential.ipfsHash);
      }
    } catch (error) {
      console.error('Delete credential error:', error);
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException('Failed to delete credential');
    }
  }

  async getPendingCredentials(query: PaginationDto) {
    const { ...paginationQuery } = query;

    return await this.repositoryService.paginate<TalentCredentialDocument>({
      model: this.credentialModel,
      query: paginationQuery,
      options: {
        verificationStatus: CredentialStatusEnum.PENDING,
        isDeleted: { $ne: true },
      },
    });
  }

  async getSingleUserCredentials(
    user: UserDocument,
    query: GetAllCredentialsDto,
  ): Promise<PaginatedCredentialResponse> {
    const {
      type,
      verificationStatus,
      verificationLevel,
      category,
      visibility,
      ...paginationQuery
    } = query;

    const result =
      await this.repositoryService.paginate<TalentCredentialDocument>({
        model: this.credentialModel,
        query: paginationQuery,
        options: {
          issuer: user._id,
          isDeleted: { $ne: true },
          ...(type && { type }),
          ...(verificationStatus && { verificationStatus }),
          ...(verificationLevel && { verificationLevel }),
          ...(category && { category: { $regex: category, $options: 'i' } }),
          ...(visibility !== undefined && { visibility }),
        },
        populateFields: [
          { path: 'issuer', select: 'username email' },
          { path: 'subject', select: 'username email' },
        ],
      });

    // Return all credentials where issuer is user._id (no extra filter)
    console.log('[CredentialService] result.data:', result.data);
    try {
      if (Array.isArray(result?.data) && result.data.length) {
        let hasInvalid = false;
        result.data.forEach(
          (credential: TalentCredentialDocument, idx: number) => {
            console.log(`[CredentialService] credential[${idx}]:`, credential);
            if (
              !credential ||
              typeof credential !== 'object' ||
              credential._id === undefined
            ) {
              hasInvalid = true;
            }
          },
        );
        if (hasInvalid) {
          console.error(
            '[CredentialService] Invalid credential found, skipping mapping.',
          );
          result.data = [];
        } else {
          const mappedData = result.data.map(
            (credential: TalentCredentialDocument) => {
              const obj =
                typeof credential.toObject === 'function'
                  ? credential.toObject()
                  : credential;

              // Format response to match frontend expectations
              const formattedCredential: CredentialResponseDto = {
                _id: obj._id.toString(),
                credentialId: obj.credentialId || `${obj._id}-${Date.now()}`,
                title: obj.name || obj.title,
                description: obj.description,
                type: obj.credentialType || obj.type,
                category: obj.category,
                issuer: obj.issuingOrganization,
                issueDate: obj.issueDate,
                expiryDate: obj.expiryDate,
                verifyingOrganization: obj.verifyingOrganization,
                verifyingEmail: obj.verifyingEmail,
                message: obj.message,
                externalUrl: obj.externalUrl,
                visibility:
                  typeof obj.visibility === 'boolean' ? obj.visibility : true,
                status: obj.verificationStatus || 'PENDING',
                imageUrl: obj.evidenceHash
                  ? `https://gateway.pinata.cloud/ipfs/${obj.evidenceHash}`
                  : null,
                createdAt:
                  obj.createdAt?.toISOString() || new Date().toISOString(),
                  reviewedAt: obj.reviewedAt?.toISOString() || null,

                // Keep backward compatibility fields
                subject: obj.subject,
                credentialType: obj.credentialType,
                evidenceHash: obj.evidenceHash,
                revocable: obj.revocable,
                updatedAt: obj.updatedAt || new Date(),
                ipfsHash: obj.ipfsHash,
                issuingOrganization: obj.issuingOrganization,
              };
              return formattedCredential;
            },
          );

          result.data = mappedData as any;
        }
      }
    } catch (err) {
      console.error('[CredentialService] Error mapping credentials:', err);
      result.data = [];
    }

    return {
      data: result.data as unknown as CredentialResponseDto[],
      meta: result.meta,
    };
  }

  async getAllOrganizationVerifiableCredentials(
    user: UserDocument,
    query: PaginationDto & {
      type?: CredentialTypeEnum;
      category?: CredentialCategoryEnum;
      verificationStatus?: CredentialStatusEnum;
    },
  ) {
    const { type, category, verificationStatus } = query;

    const baseFilter: any = {
      verifyingEmail: user.email.toLowerCase(),
    };

    if (type) baseFilter.type = type;
    if (category) baseFilter.category = category;
    if (verificationStatus) baseFilter.verificationStatus = verificationStatus;

    const [stats, result] = await Promise.all([
      this.credentialModel.aggregate([
        { $match: { verifyingEmail: user.email.toLowerCase() } },
        {
          $group: {
            _id: '$verificationStatus',
            total: { $sum: 1 },
          },
        },
      ]),
      this.repositoryService.paginate<TalentCredentialDocument>({
        model: this.credentialModel,
        query,
        options: baseFilter,
      }),
    ]);

    return {
      stats,
      data: result,
    };
  }

  async verifyCredential(credentialId: string, user: UserDocument) {
    const credential = await this.credentialModel.findById(credentialId);
    if (!credential) throw new NotFoundException('Credential not found');

    if (credential.verifyingEmail?.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException('Not authorized to verify this credential');
    }

    if (credential.verificationStatus !== CredentialStatusEnum.PENDING) {
      throw new BadRequestException('Credential has already been reviewed');
    }

    return await this.credentialModel.findByIdAndUpdate(
      credentialId,
      {
        verificationStatus: CredentialStatusEnum.VERIFIED,
        reviewedAt: new Date(),
      },
      { new: true },
    );
  }

  async rejectCredential(
    credentialId: string,
    user: UserDocument,
    reason?: string,
  ) {
    const credential = await this.credentialModel.findById(credentialId);
    if (!credential) throw new NotFoundException('Credential not found');

    if (credential.verifyingEmail?.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException('Not authorized to reject this credential');
    }

    if (credential.verificationStatus !== CredentialStatusEnum.PENDING) {
      throw new BadRequestException('Credential has already been reviewed');
    }

    return await this.credentialModel.findByIdAndUpdate(
      credentialId,
      {
        verificationStatus: CredentialStatusEnum.REJECTED,
        reviewedAt: new Date(),
        rejectionReason: reason || 'No reason provided',
      },
      { new: true },
    );
  }
}
