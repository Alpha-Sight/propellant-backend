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
  UpdateCredentialStatusDto,
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
      if (!file) {
        throw new BadRequestException(' File not Found');
      }
      const ipfsHash = await this.pinataService.uploadFile(file);

      return await this.credentialModel.create({
        user: user._id,
        ipfsHash,
        ...payload,
      });
    } catch (error) {
      throw new Error(
        `Failed to create credential with IPFS: ${error.message}`,
      );
    }
  }

  async adminGetAllCredentials(query: PaginationDto) {
    const {
      type,
      status,
      verificationLevel,
      issuer,
      visibility,
      ...paginationQuery
    } = query;

    return await this.repositoryService.paginate<CredentialDocument>({
      model: this.credentialModel,
      query: paginationQuery,
      options: {
        isDeleted: { $ne: true },
        ...(type && { type }),
        ...(status && { status }),
        ...(verificationLevel && { verificationLevel }),
        ...(issuer && { issuer: { $regex: issuer, $options: 'i' } }),
        ...(visibility !== undefined && { visibility }),
      },
    });
  }

  async updateCredentialStatus(
    credentialId: string,
    payload: UpdateCredentialStatusDto,
  ): Promise<CredentialDocument> {
    const credential = await this.credentialModel.findByIdAndUpdate(
      credentialId,
      { verificationStatus: payload.status },
      { new: true },
    );

    if (!credential) {
      throw new NotFoundException('No Credential Found');
    }

    return credential;
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

      if (credential && credential.ipfsHash) {
        await this.credentialModel.deleteOne({ _id: credentialId });
        await this.pinataService.unpinFile(credential.ipfsHash);
      }

      throw new NotFoundException('Credential not found');
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

  async getSingleUserCredentials(user: UserDocument, query: PaginationDto) {
    const {
      type,
      status,
      verificationLevel,
      issuer,
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
        ...(status && { status }),
        ...(verificationLevel && { verificationLevel }),
        ...(issuer && { issuer: { $regex: issuer, $options: 'i' } }),
        ...(visibility !== undefined && { visibility }),
      },
      populateFields: [{ path: 'user', select: 'username email' }],
    });
  }
}
