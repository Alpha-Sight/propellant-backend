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
  CredentialResponseDto,
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

  async uploadCredential(
    user: UserDocument,
    payload: UploadCredentialDto,
    file: Express.Multer.File,
  ): Promise<CredentialDocument> {
    try {
      if (!user || !user._id) {
        throw new BadRequestException('User not found or invalid');
      }
      if (!file) {
        throw new BadRequestException('File not Found');
      }
      const ipfsHash = await this.pinataService.uploadFile(file);

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
        user: user._id,
        ipfsHash,
        createdAt: now,
        status: 'PENDING', // or CredentialStatusEnum.PENDING if imported
        revocable: true,
        evidenceHash: ipfsHash, // Use IPFS hash as evidenceHash
        credentialType: credentialTypeValue,
        name: payload.title || '',
        issuer: user._id,
        subject: user._id,
        credentialId: `${user._id}-${now.getTime()}`,
        ...payload,
      };

      const created = await this.credentialModel.create(credentialData);
      const obj = typeof created.toObject === 'function' ? created.toObject() : created;
      obj.imageUrl = obj.evidenceHash ? `https://gateway.pinata.cloud/ipfs/${obj.evidenceHash}` : null;
      return obj;
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
    _id: string,
    user: UserDocument,
    payload: UpdateCredentialDto,
    file?: Express.Multer.File,
  ): Promise<CredentialDocument> {
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

      const newIpfsHash = await this.pinataService.uploadFile(file);
      existingCredential.ipfsHash = newIpfsHash;
    }

    const updatedCredential = await this.credentialModel.findByIdAndUpdate(
      _id,
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

    const obj = typeof credential.toObject === 'function' ? credential.toObject() : credential;
    obj.imageUrl = obj.evidenceHash ? `https://gateway.pinata.cloud/ipfs/${obj.evidenceHash}` : null;
    obj.visibility = typeof obj.visibility === 'boolean' ? obj.visibility : true;
    return obj;
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

    const result = await this.repositoryService.paginate<CredentialDocument>({
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
      populateFields: [ 
        { path: 'issuer', select: 'username email' },
        { path: 'subject', select: 'username email' }
      ],
    });

    // Return all credentials where issuer is user._id (no extra filter)
    console.log('[CredentialService] result.data:', result.data);
    try {
      if (Array.isArray(result?.data) && result.data.length) {
        let hasInvalid = false;
        result.data.forEach((credential: any, idx: number) => {
          console.log(`[CredentialService] credential[${idx}]:`, credential);
          if (!credential || typeof credential !== 'object' || credential._id === undefined) {
            hasInvalid = true;
          }
        });
        if (hasInvalid) {
          console.error('[CredentialService] Invalid credential found, skipping mapping.');
          result.data = [];
        } else {
          result.data = result.data.map((credential: any) => {
            const obj = typeof credential.toObject === 'function' ? credential.toObject() : credential;
            return {
              ...obj,
              _id: obj._id,
              imageUrl: obj.evidenceHash ? `https://gateway.pinata.cloud/ipfs/${obj.evidenceHash}` : null,
              visibility: typeof obj.visibility === 'boolean' ? obj.visibility : true,
            };
          });
        }
      }
    } catch (err) {
      console.error('[CredentialService] Error mapping credentials:', err);
      result.data = [];
    }
    return result;
  }
}
