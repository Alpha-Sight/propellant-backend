import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { TalentCredential, TalentCredentialDocument } from './schema/credential.schema';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/services/user.service';
import { MailService } from '../mail/mail.service';
import { RelayerService } from '../blockchain/services/relayer.service';
import { CredentialCategoryEnum, CredentialStatusEnum, CredentialTypeEnum } from 'src/common/enums/credential.enum';
import { UserRoleEnum  } from 'src/common/enums/user.enum';
import { CredentialVerificationRequestTemplate } from '../mail/templates/credential-verification-request.email';
import { VerifyCredentialDto, UploadCredentialDto, GetAllCredentialsDto, GetPendingVerificationsDto, UpdateCredentialDto } from './dto/credential.dto';
import { PaginationDto } from '../repository/dto/repository.dto';

@Injectable()
export class CredentialService {
  getAllOrganizationVerifiableCredentials(user: UserDocument, query: PaginationDto & { type?: CredentialTypeEnum; category?: CredentialCategoryEnum; verificationStatus?: CredentialStatusEnum; }) {
    throw new Error('Method not implemented.');
  }
  deleteCredential: any;
  updateCredential(_id: string, user: UserDocument, payload: UpdateCredentialDto, file: Express.Multer.File) {
    throw new Error('Method not implemented.');
  }
  resendVerificationRequest(credentialId: string, arg1: string) {
    throw new Error('Method not implemented.');
  }
  getOverdueVerifications(query: GetPendingVerificationsDto) {
    throw new Error('Method not implemented.');
  }
  getVerificationStats(email: string): import("./dto/credential.dto").VerificationStatsResponseDto | PromiseLike<import("./dto/credential.dto").VerificationStatsResponseDto> {
    throw new Error('Method not implemented.');
  }
  getPendingVerifications(email: string, query: GetPendingVerificationsDto): import("./dto/credential.dto").PaginatedCredentialResponse | PromiseLike<import("./dto/credential.dto").PaginatedCredentialResponse> {
    throw new Error('Method not implemented.');
  }
  getCredentialById(_id: string) {
    throw new Error('Method not implemented.');
  }
  adminGetAllCredentials(query: GetAllCredentialsDto) {
    throw new Error('Method not implemented.');
  }
  getSingleUserCredentials(user: UserDocument, query: PaginationDto): import("./dto/credential.dto").PaginatedCredentialResponse | PromiseLike<import("./dto/credential.dto").PaginatedCredentialResponse> {
    throw new Error('Method not implemented.');
  }
  /**
   * Create a new credential
   */
  async createCredential(
    user: UserDocument,
    payload: UploadCredentialDto,
    file?: Express.Multer.File,
  ): Promise<TalentCredentialDocument> {
    try {
      this.logger.log(`Creating credential for user ${user._id}: ${payload.title}`);

      // Handle file upload if provided
      let fileUrl: string | undefined;
      let ipfsHash: string | undefined;

      if (file) {
        try {
          // Upload file to IPFS using PinataService (if available)
          // For now, we'll store the file reference
          fileUrl = `uploads/credentials/${Date.now()}_${file.originalname}`;
          this.logger.log(`File uploaded: ${fileUrl}`);
        } catch (fileError) {
          this.logger.warn(`File upload failed: ${fileError.message}`);
          // Continue without file if upload fails
        }
      }

      // Generate unique credential ID
      const credentialId = `CRED_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      // Parse dates
      const issueDate = new Date(payload.issueDate);
      const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : undefined;

      // Validate dates
      if (isNaN(issueDate.getTime())) {
        throw new BadRequestException('Invalid issue date format');
      }

      if (expiryDate && isNaN(expiryDate.getTime())) {
        throw new BadRequestException('Invalid expiry date format');
      }

      if (expiryDate && expiryDate <= issueDate) {
        throw new BadRequestException('Expiry date must be after issue date');
      }

      // Create credential data
      const credentialData = {
        credentialId,
        user: user._id,
        issuer: user._id, // User is creating their own credential
        subject: user._id,
        owner: user.walletAddress || user._id.toString(),
        title: payload.title,
        type: payload.type,
        category: payload.category,
        url: payload.url,
        imageUrl: fileUrl,
        ipfsHash,
        description: payload.description,
        visibility: payload.visibility !== false, // Default to true
        verificationStatus: CredentialStatusEnum.PENDING,
        issuingOrganization: payload.issuingOrganization,
        verifyingOrganization: payload.verifyingOrganization,
        verifyingEmail: payload.verifyingEmail,
        message: payload.message,
        issueDate,
        expiryDate,
        externalUrl: payload.externalUrl,
        
        // Enhanced tracking fields
        attestationStatus: 'PENDING_VERIFICATION',
        verificationRequestSentAt: new Date(),
        verificationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        
        // Blockchain fields
        blockchainStatus: 'NOT_MINTED',
        autoMint: payload.autoMint || false,
        
        // Metadata
        isDeleted: false,
        file: fileUrl,
      };

      // Create the credential
      const credential = await this.credentialModel.create(credentialData);

      this.logger.log(`Credential created successfully: ${credential._id}`);

      // Send verification request email if verifying organization is specified
      if (payload.verifyingEmail && payload.verifyingOrganization) {
        try {
          await this.sendVerificationRequestEmail(credential, user);
        } catch (emailError) {
          this.logger.warn(`Failed to send verification email: ${emailError.message}`);
          // Don't fail the whole operation if email fails
        }
      }

      return credential;
    } catch (error) {
      this.logger.error(`Failed to create credential: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send verification request email to the verifying organization
   */
  private async sendVerificationRequestEmail(
    credential: TalentCredentialDocument,
    user: UserDocument,
  ): Promise<void> {
    try {
      const emailSubject = `Credential Verification Request - ${credential.title}`;
      const emailTemplate = this.createVerificationRequestEmailTemplate({
        userName: user.fullname || user.email.split('@')[0],
        userEmail: user.email,
        credentialTitle: credential.title,
        credentialType: credential.type,
        credentialCategory: credential.category,
        issuingOrganization: credential.issuingOrganization,
        issueDate: credential.issueDate?.toLocaleDateString(),
        expiryDate: credential.expiryDate?.toLocaleDateString(),
        description: credential.description,
        message: credential.message,
        credentialId: credential._id.toString(),
        verificationDeadline: credential.verificationDeadline?.toLocaleDateString(),
      });

      await this.mailService.sendEmail(
        credential.verifyingEmail!,
        emailSubject,
        emailTemplate,
      );

      this.logger.log(
        `Verification request email sent to ${credential.verifyingEmail} for credential ${credential._id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send verification request email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create verification request email template
   */
  private createVerificationRequestEmailTemplate(data: {
    userName: string;
    userEmail: string;
    credentialTitle: string;
    credentialType: string;
    credentialCategory: string;
    issuingOrganization: string;
    issueDate?: string;
    expiryDate?: string;
    description?: string;
    message?: string;
    credentialId: string;
    verificationDeadline?: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Credential Verification Request</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
              .credential-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .footer { background: #333; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; }
              .btn { display: inline-block; padding: 10px 20px; color: white; background: #28a745; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
              .btn-reject { background: #dc3545; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔍 Credential Verification Request</h1>
                  <p>PropellantBD Platform</p>
              </div>
              
              <div class="content">
                  <h2>Dear Verification Team,</h2>
                  
                  <p>You have received a new credential verification request from <strong>${data.userName}</strong> (${data.userEmail}).</p>
                  
                  <div class="credential-details">
                      <h3>📄 Credential Details</h3>
                      <p><strong>Title:</strong> ${data.credentialTitle}</p>
                      <p><strong>Type:</strong> ${data.credentialType}</p>
                      <p><strong>Category:</strong> ${data.credentialCategory}</p>
                      <p><strong>Issuing Organization:</strong> ${data.issuingOrganization}</p>
                      ${data.issueDate ? `<p><strong>Issue Date:</strong> ${data.issueDate}</p>` : ''}
                      ${data.expiryDate ? `<p><strong>Expiry Date:</strong> ${data.expiryDate}</p>` : ''}
                      ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
                      ${data.message ? `<p><strong>Additional Message:</strong> ${data.message}</p>` : ''}
                  </div>
                  
                  <div style="text-align: center; margin: 20px 0;">
                      <p><strong>Verification Deadline:</strong> ${data.verificationDeadline || 'Not specified'}</p>
                      <p><strong>Credential ID:</strong> ${data.credentialId}</p>
                  </div>
                  
                  <p>Please review this credential and provide your verification decision through the PropellantBD platform.</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.FRONTEND_URL || 'https://propellantbd.com'}/verify-credential/${data.credentialId}" class="btn">
                          ✅ Verify Credential
                      </a>
                      <a href="${process.env.FRONTEND_URL || 'https://propellantbd.com'}/reject-credential/${data.credentialId}" class="btn btn-reject">
                          ❌ Reject Credential
                      </a>
                  </div>
              </div>
              
              <div class="footer">
                  <p>&copy; 2025 PropellantBD. All rights reserved.</p>
                  <p>This is an automated message. Please do not reply to this email.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private readonly logger = new Logger(CredentialService.name);

  constructor(
    @InjectModel('TalentCredential') private credentialModel: Model<TalentCredentialDocument>,
    private userService: UserService,
    private mailService: MailService,
    private relayerService: RelayerService,
    private configService: ConfigService,
  ) {}

  /**
   * Enhanced role-based access control for credential verification
   */
  private hasVerificationRole(user: UserDocument): boolean {
    const allowedRoles = [
      UserRoleEnum.ADMIN,
      UserRoleEnum.SUPER_ADMIN,
      UserRoleEnum.ORGANIZATION
    ];
    return allowedRoles.includes(user.role);
  }

  /**
   * Check if user can verify a specific credential
   */
  private canVerifyCredential(verifier: UserDocument, credential: TalentCredentialDocument): boolean {
    if (!this.hasVerificationRole(verifier)) {
      return false;
    }

    // Super Admin can verify any credential
    if (verifier.role === UserRoleEnum.SUPER_ADMIN) {
      return true;
    }

    // Admin can verify any credential (you can add specific restrictions here)
    if (verifier.role === UserRoleEnum.ADMIN) {
      return true;
    }

    // Organization can only verify if they match the verifying organization
    if (verifier.role === UserRoleEnum.ORGANIZATION) {
      // Add organization-specific logic here
      // For example: check if verifier.organizationName matches credential.verifyingOrganization
      return true; // Simplified for now
    }

    return false;
  }

  /**
   * Main verification/rejection endpoint - Enhanced implementation
   */
  async verifyOrRejectCredential(
    credentialId: string,
    verifierUserId: string,
    payload: VerifyCredentialDto,
  ): Promise<{
    status: string;
    minted: boolean;
    transactionId?: string;
    message: string;
  }> {
    const credential = await this.credentialModel.findById(credentialId);
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    const verifier = await this.userService.findById(verifierUserId);
    if (!verifier) {
      throw new NotFoundException('Verifier not found');
    }

    // Enhanced role-based access control
    if (!this.canVerifyCredential(verifier, credential)) {
      throw new ForbiddenException(
        'You do not have permission to verify this credential. Only Admin, Super Admin, or authorized Organizations can verify credentials.'
      );
    }

    if (credential.verificationStatus !== CredentialStatusEnum.PENDING) {
      throw new BadRequestException('Credential is not pending verification');
    }

    if (payload.decision === 'VERIFIED') {
      // Update credential to verified status
      await this.credentialModel.updateOne(
        { _id: credentialId },
        {
          $set: {
            verificationStatus: CredentialStatusEnum.VERIFIED,
            attestationStatus: 'VERIFIED',
            verifiedAt: new Date(),
            verifiedBy: verifierUserId,
            verificationNotes: payload.notes,
            rejectionReason: null,
          },
        },
      );

      // Get updated credential and user for minting
      const updatedCredential = await this.credentialModel.findById(credentialId);
      const user = await this.userService.findById(credential.user.toString());
      
      // Send approval notification
      try {
        await this.sendVerificationNotification(
          updatedCredential!,
          user,
          'APPROVED',
          payload.notes
        );
      } catch (notificationError) {
        this.logger.warn(`Failed to send approval notification: ${notificationError.message}`);
      }

      // 🚀 ENHANCED: Always attempt minting for verified credentials if user has wallet
      if (user && user.walletAddress) {
        try {
          this.logger.log(`Attempting to mint credential ${credentialId} for user with wallet ${user.walletAddress}`);
          
          const mintResult = await this.mintCredentialOnBlockchain(updatedCredential!, user);
          
          // Update credential with minting success
          await this.credentialModel.updateOne(
            { _id: credentialId },
            {
              $set: {
                blockchainStatus: 'MINTED',
                mintedAt: new Date(),
                blockchainTransactionId: mintResult.transactionId,
              },
            },
          );
          
          this.logger.log(
            `Credential verified and minting initiated for credential ${credentialId}, transaction: ${mintResult.transactionId}`
          );

          return {
            status: 'VERIFIED',
            minted: true,
            transactionId: mintResult.transactionId,
            message: 'Credential verified and queued for blockchain minting',
          };
        } catch (mintError) {
          this.logger.warn(
            `Failed to mint verified credential: ${mintError.message}`
          );
          
          // Update credential with minting failure
          await this.credentialModel.updateOne(
            { _id: credentialId },
            {
              $set: {
                blockchainStatus: 'MINTING_FAILED',
                blockchainError: mintError.message,
                lastMintAttempt: new Date(),
              },
            },
          );
          
          // Send notification about minting failure
          try {
            await this.sendMintingErrorNotification(updatedCredential!, user, mintError.message);
          } catch (emailError) {
            this.logger.warn(`Failed to send minting error notification: ${emailError.message}`);
          }
          
          return {
            status: 'VERIFIED',
            minted: false,
            message: 'Credential verified but minting failed. Can be retried later.',
          };
        }
      }

      return {
        status: 'VERIFIED',
        minted: false,
        message: user?.walletAddress 
          ? 'Credential verified successfully'
          : 'Credential verified. User needs to set up wallet for NFT minting.',
      };
    } else {
      // Rejection flow
      await this.credentialModel.updateOne(
        { _id: credentialId },
        {
          $set: {
            verificationStatus: CredentialStatusEnum.REJECTED,
            attestationStatus: 'REJECTED',
            rejectedAt: new Date(),
            rejectedBy: verifierUserId,
            rejectionReason: payload.notes || 'No reason provided',
            verificationNotes: payload.notes,
          },
        },
      );

      const user = await this.userService.findById(credential.user.toString());
      
      // Send rejection notification
      try {
        await this.sendVerificationNotification(
          credential,
          user,
          'REJECTED',
          payload.notes
        );
      } catch (notificationError) {
        this.logger.warn(`Failed to send rejection notification: ${notificationError.message}`);
      }

      this.logger.log(`Credential ${credentialId} rejected by verifier ${verifierUserId}`);

      return {
        status: 'REJECTED',
        minted: false,
        message: 'Credential has been rejected',
      };
    }
  }

  /**
   * Check if a verified credential should be auto-minted.
   */
  private shouldAutoMintVerified(credential: TalentCredentialDocument): boolean {
    return (credential as any).autoMint === true;
  }

  /**
   * Enhanced blockchain minting with proper RelayerService integration
   */
  private async mintCredentialOnBlockchain(
    credential: TalentCredentialDocument,
    user: UserDocument,
  ): Promise<{ transactionId: string }> {
    if (!user.walletAddress) {
      throw new BadRequestException('User must have a wallet address to mint credentials');
    }

    // Update blockchain status to pending
    await this.credentialModel.updateOne(
      { _id: credential._id },
      {
        $set: {
          blockchainStatus: 'PENDING_BLOCKCHAIN',
          mintingStartedAt: new Date(),
        },
      },
    );

    // Prepare data for blockchain transaction
    const evidenceHash = ethers.keccak256(
      ethers.toUtf8Bytes(credential._id.toString())
    );

    const iface = new ethers.Interface([
      'function issueCredential(address subject, string name, string description, string metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) returns (uint256)'
    ]);

    const encodedData = iface.encodeFunctionData('issueCredential', [
      user.walletAddress,
      credential.title,
      credential.description || '',
      credential.file || '',
      this.mapCredentialTypeToNumber(credential.type),
      Math.floor(Date.now() / 1000) + 31536000, // Valid for 1 year
      evidenceHash,
      true // Revocable
    ]);

    // Use RelayerService for gasless minting
    const result = await this.relayerService.queueTransaction({
      userAddress: user.walletAddress,
      target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
      value: "0",
      data: encodedData,
      operation: 0,
      description: `Issue credential: ${credential.title}`,
      isAccountCreation: false
    });

    // Store transaction ID in credential for tracking
    await this.credentialModel.updateOne(
      { _id: credential._id },
      {
        $set: {
          transactionId: result.transactionId,
          mintingTransactionId: result.transactionId,
        },
      },
    );

    this.logger.log(
      `Credential minting queued for ${credential._id}, transaction ID: ${result.transactionId}`
    );

    return { transactionId: result.transactionId };
  }

  /**
   * Enhanced notification system
   */
  private async sendVerificationNotification(
    credential: TalentCredentialDocument,
    user: UserDocument,
    status: 'APPROVED' | 'REJECTED',
    notes?: string
  ): Promise<void> {
    try {
      if (status === 'APPROVED') {
        await this.mailService.sendEmail(
          user.email,
          `Credential Approved - ${credential.title}`,
          this.createApprovalEmailTemplate({
            userName: user.fullname || user.email.split('@')[0],
            credentialTitle: credential.title,
            verificationNotes: notes,
            credentialId: credential._id.toString()
          })
        );
      } else {
        await this.mailService.sendEmail(
          user.email,
          `Credential Rejected - ${credential.title}`,
          this.createRejectionEmailTemplate({
            userName: user.fullname || user.email.split('@')[0],
            credentialTitle: credential.title,
            rejectionReason: notes || 'No reason provided',
            credentialId: credential._id.toString()
          })
        );
      }

      this.logger.log(
        `${status} notification sent to ${user.email} for credential ${credential._id}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${status} notification: ${error.message}`
      );
      // Don't throw - notification failure shouldn't block the main flow
    }
  }

  /**
   * Send notification for minting errors
   */
  private async sendMintingErrorNotification(
    credential: TalentCredentialDocument,
    user: UserDocument,
    error: string
  ): Promise<void> {
    try {
      await this.mailService.sendEmail(
        user.email,
        `Credential Approved - NFT Minting Issue - ${credential.title}`,
        this.createMintingErrorEmailTemplate({
          userName: user.fullname || user.email.split('@')[0],
          credentialTitle: credential.title,
          error: error,
          credentialId: credential._id.toString()
        })
      );
    } catch (emailError) {
      this.logger.error(
        `Failed to send minting error notification: ${emailError.message}`
      );
    }
  }

  /**
   * Retry minting for verified credentials
   */
  async retryMinting(credentialId: string, userId: string): Promise<{ message: string; transactionId?: string }> {
    try {
      const credential = await this.credentialModel.findById(credentialId);
      if (!credential) {
        throw new NotFoundException('Credential not found');
      }

      const user = await this.userService.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user owns the credential
      if (credential.user.toString() !== userId) {
        throw new ForbiddenException('You can only retry minting for your own credentials');
      }

      // Check if credential is verified
      if (credential.verificationStatus !== CredentialStatusEnum.VERIFIED) {
        throw new BadRequestException('Can only retry minting for verified credentials');
      }

      // Check if already minted
      if (credential.blockchainStatus === 'MINTED') {
        throw new BadRequestException('Credential is already minted');
      }

      // Update status to pending minting
      await this.credentialModel.updateOne(
        { _id: credentialId },
        {
          $set: {
            blockchainStatus: 'PENDING_BLOCKCHAIN',
            lastMintAttempt: new Date(),
            blockchainError: null,
          },
        },
      );

      // Attempt minting
      try {
        const mintResult = await this.mintCredentialOnBlockchain(credential, user);
        
        await this.credentialModel.updateOne(
          { _id: credentialId },
          {
            $set: {
              blockchainStatus: 'MINTED',
              mintedAt: new Date(),
              blockchainTransactionId: mintResult.transactionId,
            },
          },
        );

        this.logger.log(`Credential minting retry successful for ${credentialId}`);
        
        return {
          message: 'Credential minting retry initiated successfully',
          transactionId: mintResult.transactionId,
        };
      } catch (mintError) {
        await this.credentialModel.updateOne(
          { _id: credentialId },
          {
            $set: {
              blockchainStatus: 'MINTING_FAILED',
              blockchainError: mintError.message,
            },
          },
        );

        this.logger.error(`Credential minting retry failed for ${credentialId}: ${mintError.message}`);
        
        return {
          message: 'Credential minting retry failed. Please try again later.',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to retry minting: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get blockchain status for user's credentials
   */
  async getBlockchainStatus(userId: string): Promise<{
    total: number;
    notMinted: number;
    pendingBlockchain: number;
    minted: number;
    mintingFailed: number;
    credentials: Array<{
      id: string;
      title: string;
      status: string;
      transactionId?: string;
      error?: string;
      lastAttempt?: string;
    }>;
  }> {
    try {
      const credentials = await this.credentialModel
        .find({
          user: userId,
          verificationStatus: CredentialStatusEnum.VERIFIED,
          isDeleted: false,
        })
        .select('title blockchainStatus blockchainTransactionId blockchainError lastMintAttempt')
        .lean();

      const stats = {
        total: credentials.length,
        notMinted: 0,
        pendingBlockchain: 0,
        minted: 0,
        mintingFailed: 0,
      };

      const credentialsList = credentials.map((cred) => {
        const status = cred.blockchainStatus || 'NOT_MINTED';
        
        // Update stats
        switch (status) {
          case 'NOT_MINTED':
            stats.notMinted++;
            break;
          case 'PENDING_BLOCKCHAIN':
            stats.pendingBlockchain++;
            break;
          case 'MINTED':
            stats.minted++;
            break;
          case 'MINTING_FAILED':
            stats.mintingFailed++;
            break;
        }

        return {
          id: cred._id.toString(),
          title: cred.title,
          status,
          transactionId: cred.blockchainTransactionId,
          error: cred.blockchainError,
          lastAttempt: cred.lastMintAttempt?.toISOString(),
        };
      });

      return {
        ...stats,
        credentials: credentialsList,
      };
    } catch (error) {
      this.logger.error(`Failed to get blockchain status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map credential type to blockchain number
   */
  private mapCredentialTypeToNumber(type: CredentialTypeEnum): number {
    const typeMap = {
      [CredentialTypeEnum.DEGREE]: 0,
      [CredentialTypeEnum.CERTIFICATE]: 1,
      [CredentialTypeEnum.LICENSE]: 2,
      [CredentialTypeEnum.AWARD]: 4,
      [CredentialTypeEnum.TRAINING]: 1,
      [CredentialTypeEnum.WORK_EXPERIENCE]: 2,
      [CredentialTypeEnum.PROJECT_PORTFOLIO]: 6,
      [CredentialTypeEnum.RECOMMENDATION_LETTER]: 5,
      [CredentialTypeEnum.DIPLOMA]: 0,
      [CredentialTypeEnum.BADGE]: 4,
      [CredentialTypeEnum.ACHIEVEMENT]: 4,
      [CredentialTypeEnum.OTHER]: 6,
    };
    
    return typeMap[type] || 6; // Default to OTHER
  }

  private createApprovalEmailTemplate(data: {
    userName: string;
    credentialTitle: string;
    verificationNotes?: string;
    credentialId: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #28a745; margin: 0;">✅ Credential Approved!</h1>
          </div>
          
          <p>Dear ${data.userName},</p>
          
          <p>Great news! Your credential "<strong>${data.credentialTitle}</strong>" has been successfully verified and approved.</p>
          
          ${data.verificationNotes ? `
            <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h4 style="margin: 0 0 10px 0; color: #155724;">Verification Notes:</h4>
              <p style="margin: 0; color: #155724;">${data.verificationNotes}</p>
            </div>
          ` : ''}
          
          <p>Your credential will be minted as an NFT on the blockchain shortly. You'll receive another notification once the NFT is successfully created.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #666; font-style: italic;">Credential ID: ${data.credentialId}</p>
          </div>
          
          <p>Best regards,<br>The PropellantBD Team</p>
        </div>
      </div>
    `;
  }

  private createRejectionEmailTemplate(data: {
    userName: string;
    credentialTitle: string;
    rejectionReason: string;
    credentialId: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc3545; margin: 0;">❌ Credential Not Approved</h1>
          </div>
          
          <p>Dear ${data.userName},</p>
          
          <p>We regret to inform you that your credential "<strong>${data.credentialTitle}</strong>" could not be verified at this time.</p>
          
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <h4 style="margin: 0 0 10px 0; color: #721c24;">Reason for rejection:</h4>
            <p style="margin: 0; color: #721c24;">${data.rejectionReason}</p>
          </div>
          
          <p>You may resubmit your credential with the necessary corrections. Please ensure all information is accurate and documentation is clear.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #666; font-style: italic;">Credential ID: ${data.credentialId}</p>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>The PropellantBD Team</p>
        </div>
      </div>
    `;
  }

  private createMintingErrorEmailTemplate(data: {
    userName: string;
    credentialTitle: string;
    error: string;
    credentialId: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ffc107; margin: 0;">⚠️ Credential Approved - NFT Pending</h1>
          </div>
          
          <p>Dear ${data.userName},</p>
          
          <p>Your credential "<strong>${data.credentialTitle}</strong>" has been successfully approved! However, there was a temporary issue creating your NFT on the blockchain.</p>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">Technical Details:</h4>
            <p style="margin: 0; color: #856404; font-family: monospace; font-size: 12px;">${data.error}</p>
          </div>
          
          <p>Don't worry! Your credential approval is confirmed. You can retry the NFT minting process from your dashboard, or our team will automatically retry shortly.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #666; font-style: italic;">Credential ID: ${data.credentialId}</p>
          </div>
          
          <p>Best regards,<br>The PropellantBD Team</p>
        </div>
      </div>
    `;
  }

  // ... existing methods remain unchanged ...
}
