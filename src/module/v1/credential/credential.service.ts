import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CredentialStatusEnum } from '../../../common/enums/credential.enum';
import { RepositoryService } from '../repository/repository.service';
import { CredentialDocument, Credential } from './schema/credential.schema';
import { UserDocument } from '../user/schemas/user.schema';
import {
  UploadCredentialDto,
  GetAllCredentialsDto,
  UpdateCredentialDto,
} from './dto/credential.dto';
import { PaginationDto } from '../repository/dto/repository.dto';
import { PinataService } from 'src/common/utils/pinata.util';

@Injectable()
export class CredentialService {
  constructor(
    @InjectModel(Credential.name)
    private credentialModel: Model<CredentialDocument>,
    private repositoryService: RepositoryService,
    private pinataService: PinataService,
  ) {}

  // async uploadCredential(
  //   user: UserDocument,
  //   payload: UploadCredentialDto,
  //   file: Express.Multer.File,
  // ): Promise<CredentialDocument> {
  //   try {
  //     if (!file) {
  //       throw new BadRequestException(' File not Found');
  //     }
  //     const ipfsHash = await this.pinataService.uploadFile(file);

  //     return await this.credentialModel.create({
  //       user: user._id,
  //       ipfsHash,
  //       ...payload,
  //     });
  //   } catch (error) {
  //     throw new Error(
  //       `Failed to create credential with IPFS: ${error.message}`,
  //     );
  //   }
  // }

  async uploadCredential(
  user: UserDocument,
  payload: UploadCredentialDto,
  file: Express.Multer.File,
): Promise<CredentialDocument> {
  try {
    console.log('[CredentialService] Starting uploadCredential');
    console.log('[CredentialService] User:', user?._id);
    console.log('[CredentialService] Payload:', payload);
    if (!user || !user._id) {
      console.error('[CredentialService] User not found or invalid');
      throw new BadRequestException('User not found or invalid');
    }
    if (!file) {
      console.error('[CredentialService] File not Found');
      throw new BadRequestException('File not Found');
    }
    console.log('[CredentialService] Uploading file to Pinata...');
    let ipfsHash;
    try {
      ipfsHash = await this.pinataService.uploadFile(file);
      console.log('[CredentialService] Pinata upload successful, IPFS hash:', ipfsHash);
    } catch (pinataError) {
      console.error('[CredentialService] Pinata upload failed:', pinataError);
      throw new Error(`Failed to upload file to Pinata IPFS: ${JSON.stringify(pinataError)}`);
    }

    // Set defaults for required fields
    const now = new Date();
    // Convert credentialType to number if it's an enum string
    let credentialTypeValue = payload.type;
    if (typeof credentialTypeValue === 'string') {
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
      credentialTypeValue = typeMap[payload.type] ?? 8 as any;
    }

    const credentialData = {
      user: user._id,
      ipfsHash,
      createdAt: now,
      status: 'PENDING',
      revocable: true,
      evidenceHash: ipfsHash,
      credentialType: credentialTypeValue,
      name: payload.title || '',
      issuer: user._id,
      subject: user._id,
      credentialId: `${user._id}-${now.getTime()}`,
      ...payload,
    };
    console.log('[CredentialService] Creating credential in DB:', credentialData);
    const createdCredential = await this.credentialModel.create(credentialData);
    console.log('[CredentialService] Credential created:', createdCredential?._id);
    return createdCredential;
  } catch (error) {
    console.error('[CredentialService] Failed to create credential with IPFS:', error);
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

    return await this.repositoryService.paginate<CredentialDocument>({
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
    user: UserDocument,
    payload: UpdateCredentialDto,
    file?: Express.Multer.File,
  ): Promise<CredentialDocument> {
    const { credentialId, ...updateFields } = payload;

    const existingCredential = await this.credentialModel.findOne({
      _id: credentialId,
      user: user._id,
    });

    if (!existingCredential) {
      throw new NotFoundException('No Credential Found');
    }

    // If a new file is provided, unpin the old one and upload the new file
    if (file) {
      if (existingCredential.ipfsHash) {
        await this.pinataService.unpinFile(existingCredential.ipfsHash);
      }

      const newIpfsHash = await this.pinataService.uploadFile(file);
      existingCredential.ipfsHash = newIpfsHash;
    }

    const updatedCredential = await this.credentialModel.findByIdAndUpdate(
      credentialId,
      { ...updateFields },
      { new: true },
    );

    return updatedCredential;
  }

  async getCredentialById(credentialId: string): Promise<CredentialDocument> {
    const credential = await this.credentialModel.findOne({
      _id: credentialId,
      isDeleted: { $ne: true },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return credential;
  }

  async deleteCredential(
    user: UserDocument,
    credentialId: string,
  ): Promise<void> {
    try {
      const credential = await this.credentialModel.findOne({
        _id: credentialId,
        user: user._id,
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

    return await this.repositoryService.paginate<CredentialDocument>({
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
  ) {
    const {
      type,
      verificationStatus,
      verificationLevel,
      category,
      visibility,
      ...paginationQuery
    } = query;

    return await this.repositoryService.paginate<CredentialDocument>({
      model: this.credentialModel,
      query: paginationQuery,
      options: {
        user: user._id,
        isDeleted: { $ne: true },
        ...(type && { type }),
        ...(verificationStatus && { verificationStatus }),
        ...(verificationLevel && { verificationLevel }),
        ...(category && { category: { $regex: category, $options: 'i' } }),
        ...(visibility !== undefined && { visibility }),
      },
      populateFields: [{ path: 'user', select: 'username email' }],
    });
  }
}
