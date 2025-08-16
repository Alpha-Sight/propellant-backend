import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import { ModuleRef } from '@nestjs/core';
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
  VerifyCredentialDto,
  GetPendingVerificationsDto,
  VerificationStatsResponseDto,
} from './dto/credential.dto';
import { PaginationDto } from '../repository/dto/repository.dto';
import { PinataService } from 'src/common/utils/pinata.util';
import { SubscriptionTypeEnum } from 'src/common/enums/premium.enum';
import { UserService } from '../user/services/user.service';
import { MailService } from '../mail/mail.service';
import { CredentialVerificationRequestTemplate } from '../mail/templates/credential-verification-request.email';
import { 
  IssueCredentialDto, 
  CredentialTypeEnum as BlockchainCredentialTypeEnum 
} from '../blockchain/dto/issue-credential.dto';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);

  constructor(
    @InjectModel(TalentCredential.name)
    private credentialModel: Model<TalentCredentialDocument>,
    private repositoryService: RepositoryService,
    private pinataService: PinataService,
    private userService: UserService,
    private mailService: MailService,
    private moduleRef: ModuleRef,
  ) {}

  /**
   * Upload/Create a new credential
   */
  async uploadCredential(
    user: UserDocument,
    payload: UploadCredentialDto,
    file?: Express.Multer.File,
  ): Promise<CredentialResponseDto> {
    try {
      let ipfsHash = null;
      let evidenceHash = null;

      // Handle file upload to IPFS if provided
      if (file) {
        ipfsHash = await this.pinataService.uploadFile(file, 'credential');
        evidenceHash = ipfsHash;
      }

      // Create credential data
      const credentialData = {
        user: user._id,
        issuer: user._id,
        title: payload.title,
        description: payload.description,
        type: payload.type,
        category: payload.category,
        visibility: payload.visibility !== undefined ? payload.visibility : true,
        ipfsHash,
        evidenceHash,
        issuingOrganization: payload.issuingOrganization,
        verifyingOrganization: payload.verifyingOrganization,
        verifyingEmail: payload.verifyingEmail,
        message: payload.message,
        issueDate: payload.issueDate ? new Date(payload.issueDate) : null,
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
        externalUrl: payload.externalUrl,
        verificationStatus: CredentialStatusEnum.PENDING,
        attestationStatus: payload.verifyingEmail ? 'PENDING_VERIFICATION' : 'SELF_ATTESTED',
      };

      // Set verification deadline if verification is required
      if (payload.verifyingEmail) {
        credentialData['verificationRequestSentAt'] = new Date();
        credentialData['verificationDeadline'] = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      }

      // Create the credential
      const credential = await this.credentialModel.create(credentialData);

      // Send verification request email if specified
      if (payload.verifyingEmail) {
        try {
          await this.sendVerificationRequest(credential, payload);
        } catch (emailError) {
          this.logger.warn(`Failed to send verification email: ${emailError.message}`);
          // Don't fail the credential creation if email fails
        }
      }

      // Auto-mint if conditions are met
      if (this.shouldAutoMint(payload, user)) {
        try {
          // Implementation would go here when blockchain service is available
          this.logger.log(`Auto-minting credential ${credential._id} for user ${user._id}`);
        } catch (mintError) {
          this.logger.warn(`Failed to auto-mint credential: ${mintError.message}`);
          // Don't fail the credential creation if minting fails
        }
      }

      return this.transformToResponseDto(credential);
    } catch (error) {
      this.logger.error(`Failed to upload credential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify or reject a credential (for organizations)
   */
  async verifyOrRejectCredential(
    credentialId: string,
    verifierUserId: string,
    payload: VerifyCredentialDto
  ): Promise<{
    status: string;
    minted: boolean;
    transactionId?: string;
    message: string;
  }> {
    try {
      const credential = await this.credentialModel.findById(credentialId);
      if (!credential) {
        throw new NotFoundException('Credential not found');
      }

      // Verify the user has permission to verify this credential
      const verifier = await this.userService.findById(verifierUserId);
      if (!this.canVerifyCredential(verifier, credential)) {
        throw new ForbiddenException('You do not have permission to verify this credential');
      }

      if (payload.decision === 'VERIFIED') {
        // ✅ VERIFIED: Update status and attempt minting
        await this.credentialModel.updateOne(
          { _id: credentialId },
          {
            $set: {
              verificationStatus: CredentialStatusEnum.VERIFIED,
              attestationStatus: 'VERIFIED',
              verifiedAt: new Date(),
              verifiedBy: verifierUserId,
              verificationNotes: payload.notes,
              rejectionReason: null
            }
          }
        );

        // Auto-mint if user has wallet
        const user = await this.userService.findById(credential.user.toString());
        if (user && (user as any).walletAddress && this.shouldAutoMintVerified(credential)) {
          try {
            const mintResult = await this.mintCredentialOnBlockchain(credential, user);
            return {
              status: 'VERIFIED',
              minted: true,
              transactionId: mintResult.transactionId,
              message: 'Credential verified and queued for blockchain minting'
            };
          } catch (mintError) {
            this.logger.warn(`Failed to mint verified credential: ${mintError.message}`);
            return {
              status: 'VERIFIED',
              minted: false,
              message: 'Credential verified but minting failed. Can be retried later.'
            };
          }
        }

        return {
          status: 'VERIFIED',
          minted: false,
          message: 'Credential verified. User needs wallet address for minting.'
        };

      } else {
        // ❌ REJECTED: Update status with rejection details
        await this.credentialModel.updateOne(
          { _id: credentialId },
          {
            $set: {
              verificationStatus: CredentialStatusEnum.REJECTED,
              attestationStatus: 'REJECTED',
              rejectedAt: new Date(),
              rejectedBy: verifierUserId,
              rejectionReason: payload.notes || 'No reason provided',
              verificationNotes: payload.notes
            }
          }
        );

        return {
          status: 'REJECTED',
          minted: false,
          message: 'Credential rejected successfully'
        };
      }

    } catch (error) {
      this.logger.error(`Failed to verify/reject credential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper method to determine if a credential should be auto-minted
   */
  private shouldAutoMint(payload: UploadCredentialDto, user: UserDocument): boolean {
    // Auto-mint if it's a self-issued credential (no verifying email)
    return !payload.verifyingEmail;
  }

  /**
   * Helper method to check if a user can verify a credential
   */
  private canVerifyCredential(verifier: UserDocument, credential: TalentCredentialDocument): boolean {
    if (!verifier || !credential) return false;
    
    // Check if the verifier's email matches the credential's verifying email
    if (credential.verifyingEmail && verifier.email === credential.verifyingEmail) {
      return true;
    }
    
    // Check if the verifier's organization matches the credential's verifying organization
    if (credential.verifyingOrganization && (verifier as any).organization === credential.verifyingOrganization) {
      return true;
    }
    
    return false;
  }

  /**
   * Helper method to determine if a verified credential should be auto-minted
   */
  private shouldAutoMintVerified(credential: TalentCredentialDocument): boolean {
    // Auto-mint verified credentials by default
    return true;
  }


  /**
   * Get all credentials with admin privileges
   */
  async adminGetAllCredentials(query: GetAllCredentialsDto): Promise<PaginatedCredentialResponse> {
    const {
      page = 1,
      size = 10,
      type,
      verificationStatus,
      verificationLevel,
      category,
      visibility,
      blockchainStatus,
      attestationStatus,
      verifyingOrganization,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = query;

    const filter: any = {
      isDeleted: false
    };

    if (type) filter.type = type;
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (category) filter.category = category;
    if (visibility !== undefined) filter.visibility = visibility;
    if (blockchainStatus) filter.blockchainStatus = blockchainStatus;
    if (attestationStatus) filter.attestationStatus = attestationStatus;
    if (verifyingOrganization) filter.verifyingOrganization = verifyingOrganization;

    const sortOptions: any = {};
    sortOptions[sortBy] = sortDirection === 'desc' ? -1 : 1;

    const result = await this.repositoryService.paginate<TalentCredentialDocument>({
      model: this.credentialModel,
      query: { page, size },
      options: filter,
      populateFields: [
        { path: 'user', select: 'fullname email' },
        { path: 'verifiedBy', select: 'fullname email' }
      ]
    });

    return {
      data: result.data.map(credential => this.transformToResponseDto(credential)),
      meta: result.meta
    };
  }

  /**
   * Get a single credential by ID
   */
  async getCredentialById(_id: string): Promise<CredentialResponseDto> {
    const credential = await this.credentialModel
      .findById(_id)
      .populate('user', 'fullname email')
      .populate('verifiedBy', 'fullname email')
      .populate('rejectedBy', 'fullname email');

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return this.transformToResponseDto(credential);
  }

  /**
   * Get overdue verifications for admin monitoring
   */
  async getOverdueVerifications(query: GetPendingVerificationsDto): Promise<PaginatedCredentialResponse> {
    const {
      page = 1,
      size = 10,
      sortBy = 'verificationDeadline',
      sortDirection = 'asc',
    } = query;

    const filter = {
      verificationStatus: CredentialStatusEnum.PENDING,
      verificationDeadline: { $lt: new Date() }, // Past deadline
      isDeleted: false
    };

    const sortOptions: any = {};
    sortOptions[sortBy] = sortDirection === 'desc' ? -1 : 1;

    const result = await this.repositoryService.paginate<TalentCredentialDocument>({
      model: this.credentialModel,
      query: { page, size },
      options: filter,
      populateFields: [
        { path: 'user', select: 'fullname email' },
        { path: 'verifiedBy', select: 'fullname email' }
      ]
    });

    return {
      data: result.data.map(credential => this.transformToResponseDto(credential)),
      meta: result.meta
    };
  }

  /**
   * Resend verification request email
   */
  async resendVerificationRequest(credentialId: string, userId: string): Promise<{ message: string }> {
    const credential = await this.credentialModel.findById(credentialId);
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Check if user owns the credential
    if (credential.user.toString() !== userId) {
      throw new ForbiddenException('You can only resend verification for your own credentials');
    }

    if (!credential.verifyingEmail) {
      throw new BadRequestException('No verification email specified for this credential');
    }

    if (credential.attestationStatus !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Credential is not in pending verification status');
    }

    try {
      const user = await this.userService.findById(userId);
      await this.sendVerificationRequest(credential, {
        verifyingEmail: credential.verifyingEmail,
        verifyingOrganization: credential.verifyingOrganization,
        issuingOrganization: credential.issuingOrganization,
        title: credential.title,
        message: credential.message,
        issueDate: credential.issueDate?.toISOString(),
        expiryDate: credential.expiryDate?.toISOString(),
        externalUrl: credential.externalUrl,
      } as UploadCredentialDto);

      // Update verification request sent timestamp
      await this.credentialModel.updateOne(
        { _id: credentialId },
        { 
          $set: { 
            verificationRequestSentAt: new Date(),
            verificationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Reset 7 days deadline
          }
        }
      );

      return { message: 'Verification request resent successfully' };
    } catch (error) {
      this.logger.error(`Failed to resend verification request: ${error.message}`);
      throw new BadRequestException('Failed to resend verification request');
    }
  }

  /**
   * Retry minting for verified credentials
   */
  async retryMinting(credentialId: string, userId: string): Promise<{ message: string; transactionId?: string }> {
    const credential = await this.credentialModel.findById(credentialId);
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Check if user owns the credential
    if (credential.user.toString() !== userId) {
      throw new ForbiddenException('You can only retry minting for your own credentials');
    }

    if (credential.verificationStatus !== CredentialStatusEnum.VERIFIED) {
      throw new BadRequestException('Only verified credentials can be minted');
    }

    if (credential.blockchainStatus === 'MINTED') {
      throw new BadRequestException('Credential is already minted');
    }

    if (credential.blockchainStatus === 'PENDING_BLOCKCHAIN') {
      throw new BadRequestException('Credential minting is already in progress');
    }

    try {
      const user = await this.userService.findById(userId);
      if (!(user as any).walletAddress) {
        throw new BadRequestException('User must have a wallet address to mint credentials');
      }

      const mintResult = await this.mintCredentialOnBlockchain(credential, user);
      
      return {
        message: 'Credential minting retry initiated successfully',
        transactionId: mintResult.transactionId
      };
    } catch (error) {
      this.logger.error(`Failed to retry minting: ${error.message}`);
      throw new BadRequestException(`Failed to retry minting: ${error.message}`);
    }
  }

  /**
   * Get blockchain status for user's credentials
   */
  async getBlockchainStatus(userId: string): Promise<{
    totalCredentials: number;
    minted: number;
    pending: number;
    failed: number;
    notMinted: number;
    credentials: Array<{
      _id: string;
      title: string;
      blockchainStatus: string;
      transactionId?: string;
      mintedAt?: string;
    }>;
  }> {
    const credentials = await this.credentialModel.find({
      user: userId,
      isDeleted: false,
      verificationStatus: CredentialStatusEnum.VERIFIED
    }).select('title blockchainStatus blockchainTransactionId mintedAt');

    const stats = {
      totalCredentials: credentials.length,
      minted: 0,
      pending: 0,
      failed: 0,
      notMinted: 0
    };

    credentials.forEach(credential => {
      switch (credential.blockchainStatus) {
        case 'MINTED':
          stats.minted++;
          break;
        case 'PENDING_BLOCKCHAIN':
          stats.pending++;
          break;
        case 'MINTING_FAILED':
          stats.failed++;
          break;
        default:
          stats.notMinted++;
      }
    });

    return {
      ...stats,
      credentials: credentials.map(credential => ({
        _id: credential._id.toString(),
        title: credential.title,
        blockchainStatus: credential.blockchainStatus,
        transactionId: credential.blockchainTransactionId,
        mintedAt: credential.mintedAt?.toISOString()
      }))
    };
  }

  /**
   * Update an existing credential
   */
  async updateCredential(
    _id: string,
    user: UserDocument,
    payload: UpdateCredentialDto,
    file?: Express.Multer.File,
  ): Promise<CredentialResponseDto> {
    const credential = await this.credentialModel.findById(_id);
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Check if user owns the credential
    if (credential.user.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only update your own credentials');
    }

    const updateData: any = {};

    if (payload.title) updateData.title = payload.title;
    if (payload.description) updateData.description = payload.description;
    if (payload.type) updateData.type = payload.type;
    if (payload.category) updateData.category = payload.category;
    if (payload.visibility !== undefined) updateData.visibility = payload.visibility;
    if (payload.issuingOrganization) updateData.issuingOrganization = payload.issuingOrganization;
    if (payload.verifyingOrganization) updateData.verifyingOrganization = payload.verifyingOrganization;
    if (payload.verifyingEmail) updateData.verifyingEmail = payload.verifyingEmail;
    if (payload.message) updateData.message = payload.message;
    if (payload.externalUrl) updateData.externalUrl = payload.externalUrl;
    if (payload.issueDate) updateData.issueDate = new Date(payload.issueDate);
    if (payload.expiryDate) updateData.expiryDate = new Date(payload.expiryDate);

    // Handle file upload if provided
    if (file) {
      const ipfsHash = await this.pinataService.uploadFile(file, 'credential');
      updateData.ipfsHash = ipfsHash;
      updateData.evidenceHash = ipfsHash;
    }

    updateData.updatedAt = new Date();

    const updatedCredential = await this.credentialModel.findByIdAndUpdate(
      _id,
      { $set: updateData },
      { new: true }
    );

    return this.transformToResponseDto(updatedCredential);
  }

  /**
   * Delete a credential (soft delete)
   */
  async deleteCredential(user: UserDocument, _id: string): Promise<{ message: string }> {
    const credential = await this.credentialModel.findById(_id);
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Check if user owns the credential
    if (credential.user.toString() !== user._id.toString()) {
      throw new ForbiddenException('You can only delete your own credentials');
    }

    await this.credentialModel.updateOne(
      { _id },
      { 
        $set: { 
          isDeleted: true,
          deletedAt: new Date()
        }
      }
    );

    return { message: 'Credential deleted successfully' };
  }

  /**
   * Get all organization verifiable credentials
   */
  async getAllOrganizationVerifiableCredentials(
    user: UserDocument,
    query: PaginationDto & {
      type?: CredentialTypeEnum;
      category?: CredentialCategoryEnum;
      verificationStatus?: CredentialStatusEnum;
    },
  ): Promise<PaginatedCredentialResponse> {
    const {
      page = 1,
      size = 10,
      type,
      category,
      verificationStatus,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = query;

    const filter: any = {
      $or: [
        { verifyingEmail: user.email },
        { verifyingOrganization: (user as any).organization }
      ],
      isDeleted: false
    };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (verificationStatus) filter.verificationStatus = verificationStatus;

    const sortOptions: any = {};
    sortOptions[sortBy] = sortDirection === 'desc' ? -1 : 1;

    const result = await this.repositoryService.paginate<TalentCredentialDocument>({
      model: this.credentialModel,
      query: { page, size },
      options: filter,
      populateFields: [
        { path: 'user', select: 'fullname email' },
        { path: 'verifiedBy', select: 'fullname email' }
      ]
    });

    return {
      data: result.data.map(credential => this.transformToResponseDto(credential)),
      meta: result.meta
    };
  }

  /**
   * Fixed transform method to match CredentialResponseDto interface
   */
  transformToResponseDto(credential: TalentCredentialDocument): CredentialResponseDto {
    return {
      _id: credential._id.toString(),
      credentialId: credential.credentialId || `${credential.user}-${credential.createdAt?.getTime()}`,
      title: credential.title,
      description: credential.description,
      type: credential.type,
      category: credential.category,
      issuer: credential.issuer?.toString() || credential.user.toString(),
      visibility: credential.visibility,
      status: credential.verificationStatus as "PENDING" | "VERIFIED" | "REJECTED",
      ipfsHash: credential.ipfsHash,
      issuingOrganization: credential.issuingOrganization,
      verifyingOrganization: credential.verifyingOrganization,
      verifyingEmail: credential.verifyingEmail,
      message: credential.message,
      issueDate: credential.issueDate,
      expiryDate: credential.expiryDate,
      externalUrl: credential.externalUrl,
      attestationStatus: credential.attestationStatus,
      blockchainStatus: credential.blockchainStatus as "NOT_MINTED" | "PENDING_BLOCKCHAIN" | "MINTED" | "MINTING_FAILED",
      createdAt: credential.createdAt?.toISOString(),
      updatedAt: (credential as any).updatedAt?.toISOString(), // Type assertion for timestamps
      // Verification fields
      verifiedBy: credential.verifiedBy?.toString(),
      rejectedBy: credential.rejectedBy?.toString(),
      rejectedAt: credential.rejectedAt?.toISOString(),
      verificationNotes: credential.verificationNotes,
      verificationRequestSentAt: credential.verificationRequestSentAt?.toISOString(),
      verificationDeadline: credential.verificationDeadline?.toISOString(),
      // Blockchain fields
      blockchainCredentialId: credential.blockchainCredentialId,
      blockchainTransactionId: credential.blockchainTransactionId,
      mintedAt: credential.mintedAt?.toISOString(),
      // Legacy compatibility
      subject: credential.subject,
      credentialType: credential.credentialType,
      evidenceHash: credential.evidenceHash,
      revocable: credential.revocable,
    };
  }

  /**
   * Fixed getPendingVerifications method
   */
  async getPendingVerifications(
    organizationEmail: string,
    query: GetPendingVerificationsDto
  ): Promise<PaginatedCredentialResponse> {
    const {
      page = 1,
      size = 10,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = query;

    const filter = {
      verifyingEmail: organizationEmail,
      verificationStatus: CredentialStatusEnum.PENDING,
      isDeleted: false
    };

    const sortOptions: any = {};
    sortOptions[sortBy] = sortDirection === 'desc' ? -1 : 1;

    const result = await this.repositoryService.paginate<TalentCredentialDocument>({
      model: this.credentialModel,
      query: { page, size },
      options: filter,
      populateFields: [
        { path: 'user', select: 'fullname email' },
        { path: 'verifiedBy', select: 'fullname email' }
      ]
    });

    return {
      data: result.data.map(credential => this.transformToResponseDto(credential)),
      meta: result.meta
    };
  }

  /**
   * Fixed getVerificationStats method
   */
  async getVerificationStats(organizationIdentifier: string): Promise<VerificationStatsResponseDto> {
    const filter = {
      $or: [
        { verifyingEmail: organizationIdentifier },
        { verifyingOrganization: organizationIdentifier }
      ],
      isDeleted: false
    };

    const stats = await this.credentialModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    const pending = Number(statsMap[CredentialStatusEnum.PENDING] || 0);
    const verified = Number(statsMap[CredentialStatusEnum.VERIFIED] || 0);
    const rejected = Number(statsMap[CredentialStatusEnum.REJECTED] || 0);

    // Get overdue verifications count
    const overdueVerifications = await this.credentialModel.countDocuments({
      ...filter,
      verificationStatus: CredentialStatusEnum.PENDING,
      verificationDeadline: { $lt: new Date() }
    });

    return {
      pending,
      verified,
      rejected,
      total: pending + verified + rejected,
      overdueVerifications,
      averageVerificationTime: 0, // TODO: Calculate this properly
    };
  }

  /**
   * Fixed getSingleUserCredentials method
   */
  async getSingleUserCredentials(
    user: UserDocument,
    query: PaginationDto,
  ): Promise<PaginatedCredentialResponse> {
    const {
      page = 1,
      size = 10,
      sortBy = 'createdAt',
      sortDirection = 'desc',
    } = query;

    const filter = {
      user: user._id,
      isDeleted: false
    };

    const sortOptions: any = {};
    sortOptions[sortBy] = sortDirection === 'desc' ? -1 : 1;

    const result = await this.repositoryService.paginate<TalentCredentialDocument>({
      model: this.credentialModel,
      query: { page, size },
      options: filter,
      populateFields: [
        { path: 'user', select: 'fullname email' },
        { path: 'verifiedBy', select: 'fullname email' }
      ]
    });

    return {
      data: result.data.map(credential => this.transformToResponseDto(credential)),
      meta: result.meta
    };
  }

  /**
   * Send verification request email
   */
  private async sendVerificationRequest(
    credential: TalentCredentialDocument,
    payload: UploadCredentialDto
  ): Promise<void> {
    if (!payload.verifyingEmail) return;

    const user = await this.userService.findById(credential.user.toString());
    if (!user) throw new NotFoundException('User not found');
    
    const userName = user.fullname || 'User';

    const emailData = {
      verifyingOrganization: payload.verifyingOrganization || 'Organization',
      verifyingEmail: payload.verifyingEmail,
      issuingOrganization: payload.issuingOrganization,
      credentialTitle: credential.title,
      userName: userName,
      message: payload.message,
      issueDate: payload.issueDate,
      expiryDate: payload.expiryDate,
      url: payload.externalUrl
    };

    const emailTemplate = CredentialVerificationRequestTemplate(emailData);

    await this.mailService.sendEmail(
      payload.verifyingEmail,
      `Credential Verification Request - ${credential.title}`,
      emailTemplate
    );

    this.logger.log(`Verification request email sent to ${payload.verifyingEmail} for credential ${credential._id}`);
  }

  /**
   * Maps credential type enum to number for blockchain compatibility
   */
  private mapCredentialTypeToNumber(type: CredentialTypeEnum): number {
    switch (type) {
      case CredentialTypeEnum.CERTIFICATE:
        return 1;
      case CredentialTypeEnum.DEGREE:
        return 2;
      case CredentialTypeEnum.DIPLOMA:
        return 3;
      case CredentialTypeEnum.BADGE:
        return 4;
      case CredentialTypeEnum.LICENSE:
        return 5;
      case CredentialTypeEnum.ACHIEVEMENT:
        return 6;
      default:
        return 0; // Default/unknown type
    }
  }

  /**
   * Placeholder for blockchain minting - implement based on your blockchain service
   */
  private async mintCredentialOnBlockchain(credential: TalentCredentialDocument, user: UserDocument): Promise<{ transactionId: string }> {
    // This should integrate with your blockchain service
    // For now, returning a placeholder
    this.logger.log(`Minting credential ${credential._id} for user ${user._id}`);
    
    // Update blockchain status to pending
    await this.credentialModel.updateOne(
      { _id: credential._id },
      { 
        $set: { 
          blockchainStatus: 'PENDING_BLOCKCHAIN',
          mintingStartedAt: new Date()
        }
      }
    );
    
    return { transactionId: `tx_${Date.now()}` };
  }
}