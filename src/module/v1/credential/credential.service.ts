import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { TalentCredentialDocument } from './schema/credential.schema';
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
  createCredential(user: UserDocument, payload: UploadCredentialDto, file: Express.Multer.File) {
    throw new Error('Method not implemented.');
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
      const user = await this.userService.findById(credential.user.toString());
      
      // Send approval notification
      await this.sendVerificationNotification(
        credential,
        user,
        'APPROVED',
        payload.notes
      );

      // Auto-mint if user has wallet and minting is enabled
      if (user && user.walletAddress && this.shouldAutoMintVerified(credential)) {
        try {
          const mintResult = await this.mintCredentialOnBlockchain(credential, user);
          
          this.logger.log(
            `Credential verified and minting initiated for credential ${credentialId}`
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
          
          // Send notification about minting failure
          await this.sendMintingErrorNotification(credential, user, mintError.message);
          
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
      await this.sendVerificationNotification(
        credential,
        user,
        'REJECTED',
        payload.notes
      );

      this.logger.log(`Credential ${credentialId} rejected by verifier ${verifierUserId}`);

      return {
        status: 'REJECTED',
        minted: false,
        message: 'Credential has been rejected',
      };
    }
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
   * Enhanced retry minting functionality
   */
  async retryMinting(
    credentialId: string,
    userId: string,
  ): Promise<{ message: string; transactionId?: string }> {
    const credential = await this.credentialModel.findById(credentialId);
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Check if user owns the credential
    if (credential.user.toString() !== userId) {
      throw new ForbiddenException(
        'You can only retry minting for your own credentials',
      );
    }

    if (credential.verificationStatus !== CredentialStatusEnum.VERIFIED) {
      throw new BadRequestException('Only verified credentials can be minted');
    }

    if (credential.blockchainStatus === 'MINTED') {
      throw new BadRequestException('Credential is already minted');
    }

    if (credential.blockchainStatus === 'PENDING_BLOCKCHAIN') {
      throw new BadRequestException(
        'Credential minting is already in progress',
      );
    }

    try {
      const user = await this.userService.findById(userId);
      if (!user.walletAddress) {
        throw new BadRequestException(
          'User must have a wallet address to mint credentials',
        );
      }

      const mintResult = await this.mintCredentialOnBlockchain(credential, user);

      return {
        message: 'Credential minting retry initiated successfully',
        transactionId: mintResult.transactionId,
      };
    } catch (error) {
      this.logger.error(`Failed to retry minting: ${error.message}`);
      throw new BadRequestException(
        `Failed to retry minting: ${error.message}`,
      );
    }
  }

  /**
   * Get blockchain status for user's credentials
   */
  async getBlockchainStatus(userId: string): Promise<any> {
    const credentials = await this.credentialModel.find({
      user: userId,
      verificationStatus: CredentialStatusEnum.VERIFIED
    }).select('title blockchainStatus transactionId mintingStartedAt createdAt');

    return {
      totalVerified: credentials.length,
      minted: credentials.filter(c => c.blockchainStatus === 'MINTED').length,
      pending: credentials.filter(c => c.blockchainStatus === 'PENDING_BLOCKCHAIN').length,
      failed: credentials.filter(c => c.blockchainStatus === 'FAILED').length,
      credentials: credentials
    };
  }

  /**
   * Helper methods
   */
  private shouldAutoMintVerified(credential: TalentCredentialDocument): boolean {
    // Add your business logic here
    // For example: only mint certain types of credentials automatically
    return true; // Simplified for now
  }

  private mapCredentialTypeToNumber(type: string): number {
    const typeMap = {
      'EDUCATION': 0,
      'EXPERIENCE': 1,
      'SKILL': 2,
      'CERTIFICATION': 3,
      'OTHER': 4
    };
    return typeMap[type?.toUpperCase()] || 4;
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
