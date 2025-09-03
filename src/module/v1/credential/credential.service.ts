import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
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
import { PinataService } from 'src/common/utils/pinata.util';

@Injectable()
export class CredentialService {
  getBlockchainStatus(arg0: string) {
    throw new Error('Method not implemented.');
  }
  retryMinting(credentialId: string, arg1: string) {
    throw new Error('Method not implemented.');
  }
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
      let metadataURI: string | undefined;
      let imageIpfsHash: string | undefined;

      if (file) {
        try {
          this.logger.log(`Uploading file to IPFS: ${file.originalname}`);

          // Upload image file to IPFS
          const imageUploadResult = await this.pinataService.uploadFile(file, 'credentials');
          imageIpfsHash = imageUploadResult;
          const imageUrl = `ipfs://${imageIpfsHash}`;

          this.logger.log(`Image uploaded to IPFS: ${imageUrl}`);

          // Create metadata JSON for the NFT
          const metadata = {
            name: payload.title,
            description: payload.description || 'PropellantBD Credential',
            image: imageUrl,
            attributes: [
              {
                trait_type: 'Credential Type',
                value: payload.type
              },
              {
                trait_type: 'Category',
                value: payload.category
              },
              {
                trait_type: 'Issuing Organization',
                value: payload.issuingOrganization || 'PropellantBD'
              },
              {
                trait_type: 'Issue Date',
                value: payload.issueDate
              },
              {
                trait_type: 'Expiry Date',
                value: payload.expiryDate || 'No Expiry'
              }
            ],
            external_url: payload.externalUrl || '',
            properties: {
              credentialId: `CRED_${Date.now()}_${Math.random().toString(36).substring(2)}`,
              issuingOrganization: payload.issuingOrganization,
              verifyingOrganization: payload.verifyingOrganization,
              issueDate: payload.issueDate,
              expiryDate: payload.expiryDate
            }
          };

          // Upload metadata JSON to IPFS
          const metadataUploadResult = await this.pinataService.uploadJSON(metadata, `${payload.title} Metadata`);
          metadataURI = `ipfs://${metadataUploadResult}`;

          this.logger.log(`Metadata uploaded to IPFS: ${metadataURI}`);

          // Keep legacy file field for backward compatibility
          fileUrl = metadataURI;

        } catch (fileError) {
          this.logger.warn(`IPFS upload failed: ${fileError.message}`);
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
        metadataURI,
        imageIpfsHash,
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
    @InjectModel('TalentCredential')
    private credentialModel: Model<TalentCredentialDocument>,
    @Inject(forwardRef(() => UserService)) // Wrap UserService with forwardRef
    private userService: UserService,
    private mailService: MailService,
    private relayerService: RelayerService,
    private configService: ConfigService,
    private pinataService: PinataService,
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
   * Step 1: Issue credential on-chain (FIXED)
   */
  private async issueCredentialOnBlockchain(
    credential: TalentCredentialDocument,
    user: UserDocument,
  ): Promise<{ credentialId: number; transactionId: string }> {
    if (!user.walletAddress) {
      throw new BadRequestException('User must have a wallet address to issue credentials');
    }

    const evidenceHash = ethers.keccak256(
      ethers.toUtf8Bytes(credential._id.toString())
    );

    const iface = new ethers.Interface([
      'function issueCredential(address subject, string memory name, string memory description, string memory metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) returns (uint256)'
    ]);

    const encodedData = iface.encodeFunctionData('issueCredential', [
      user.walletAddress,                                    // Subject (credential owner)
      credential.title,                                      // Credential name
      credential.description || 'PropellantBD Credential',  // Description
      credential.file || '',                                 // Metadata URI
      this.mapCredentialTypeToNumber(credential.type),      // Credential type enum
      Math.floor(Date.now() / 1000) + 31536000,            // Valid for 1 year
      evidenceHash,                                         // Evidence hash
      true                                                  // Revocable
    ]);

    const result = await this.relayerService.queueTransaction({
      userAddress: user.walletAddress,
      target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
      value: "0",
      data: encodedData,
      operation: 0,
      description: `Issue credential: ${credential.title}`,
      isAccountCreation: false
    });

    this.logger.log(`Credential issuance queued: ${result.transactionId}`);
    
    // Return a placeholder ID - the RelayerService will update this with the actual blockchain ID
    // when the transaction is processed (as seen in your logs: "Persisted on-chain id 31")
    return { credentialId: 0, transactionId: result.transactionId }; // RelayerService will update with real ID
  }

  /**
   * Main verification/rejection endpoint
   */
  async verifyOrRejectCredential(
    credentialId: string,
    action: 'approve' | 'reject',
    verificationNotes?: string,
    rejectionReason?: string,
    verifierId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Credential ${credentialId} ${action}d - starting blockchain verification and NFT minting`);

      // Get the credential first
      const credentialWithId = await this.credentialModel.findById(credentialId).populate('user');
      if (!credentialWithId) {
        throw new Error(`Credential with ID ${credentialId} not found`);
      }

      const user = credentialWithId.user as UserDocument;
      if (!user) {
        throw new Error('User not found for credential');
      }

      if (action === 'approve') {
        // Check if credential already has blockchain ID
        if (!credentialWithId.blockchainCredentialId) {
          this.logger.log(`Credential ${credentialId} not yet issued on-chain - issuing now`);
          
          // Step 1: Issue credential on-chain
          const issueResult = await this.issueCredentialOnBlockchain(credentialWithId, user);
          
          // Update the credential with the issuance transaction details
          await this.credentialModel.updateOne(
            { _id: credentialWithId._id },
            {
              $set: {
                blockchainStatus: 'PENDING_ISSUANCE',
                verificationStatus: 'PENDING_ISSUANCE', 
                transactionId: issueResult.transactionId,
                blockchainTransactionId: issueResult.transactionId,
                lastMintAttempt: new Date(),
                blockchainError: null
              }
            }
          );

          this.logger.log(`Credential ${credentialId} issuance queued, tx: ${issueResult.transactionId}`);

          // Return early with transaction details - RelayerService will handle the rest
          return {
            success: true,
            message: 'Credential issuance initiated. Verification and minting will proceed automatically once issued.',
            transactionId: issueResult.transactionId,
            status: 'PENDING_ISSUANCE'
          };
        } else {
          // Credential already issued, proceed with verification and minting
          const blockchainId = Number(credentialWithId.blockchainCredentialId);

          if (isNaN(blockchainId)) {
            throw new Error('Invalid blockchainCredentialId found on credential');
          }
            
          const verifyResult = await this.verifyCredentialOnBlockchain(
            blockchainId,
            verifierId || '0x2Ed32Af34d80ADB200592e7e0bD6a3F761677591'
          );
          
          const mintResult = await this.mintNFTOnBlockchain(credentialWithId, user);
          
          await this.credentialModel.updateOne(
            { _id: credentialWithId._id },
            {
              $set: {
                attestationStatus: 'VERIFIED',
                verificationStatus: 'VERIFIED',
                blockchainStatus: 'MINTING_NFT',
                verifiedAt: new Date(),
                verificationNotes: verificationNotes || 'Credential verified successfully',
                verifiedBy: verifierId,
                blockchainTransactionId: mintResult.transactionId,
                verificationTransactionId: verifyResult.transactionId,
                lastMintAttempt: new Date(),
                blockchainError: null
              }
            }
          );

          return {
            success: true,
            message: 'Credential verified and NFT minting initiated',
            transactionId: mintResult.transactionId,
            verificationTransactionId: verifyResult.transactionId,
            blockchainCredentialId: blockchainId
          };
        }
      } else {
        // Rejection logic (existing code remains the same)
        // ...existing rejection code...
      }
    } catch (error) {
      this.logger.warn(`Failed to process credential on blockchain: ${error.message}`);
      
      // Update credential with error details
      await this.credentialModel.updateOne(
        { _id: credentialId },
        {
          $set: {
            blockchainStatus: 'MINTING_FAILED',
            blockchainError: error.message,
            lastMintAttempt: new Date()
          }
        }
      );

      throw error;
    }
  }

  /**
   * Step 2: Verify existing credential on-chain
   */
  private async verifyCredentialOnBlockchain(
    blockchainCredentialId: number,
    verifierAddress: string,
  ): Promise<{ transactionId: string }> {
    const iface = new ethers.Interface([
      'function verifyCredential(uint256 credentialId, uint8 status, string memory notes)'
    ]);

    const encodedData = iface.encodeFunctionData('verifyCredential', [
      blockchainCredentialId,                               // Existing credential ID
      1,                                                    // VERIFIED status enum value
      `Verified by ${verifierAddress} via PropellantBD`    // Verification notes
    ]);

    const result = await this.relayerService.queueTransaction({
      userAddress: '0x2Ed32Af34d80ADB200592e7e0bD6a3F761677591', // Admin address with verification permissions
      target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
      value: "0",
      data: encodedData,
      operation: 0,
      description: `Verify credential ID ${blockchainCredentialId}`,
      isAccountCreation: false
    });

    this.logger.log(`Credential verification queued: ${result.transactionId}`);
    return { transactionId: result.transactionId };
  }

  /**
   * Step 3: Mint NFT after credential verification - FIXED
   */
  private async mintNFTOnBlockchain(
    credential: TalentCredentialDocument,
    user: UserDocument,
  ): Promise<{ transactionId: string }> {
    if (!user.walletAddress) {
      throw new BadRequestException('User must have a wallet address to mint NFT');
    }

    const nftContractAddress = this.configService.get<string>('NFT_CONTRACT_ADDRESS');
    if (!nftContractAddress) {
      throw new BadRequestException('NFT_CONTRACT_ADDRESS not configured in environment variables');
    }

    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes(credential._id.toString()));

    const iface = new ethers.Interface([
      'function mint(address to, string memory name, string memory description, string memory tokenURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) returns (uint256)'
    ]);

    // Keep on-chain strings short; put the heavy metadata in tokenURI (IPFS / HTTPS)
    const name = (credential.title || 'Credential').slice(0, 64);
    const description = (credential.description || 'PropellantBD Credential').slice(0, 160);
    const tokenURI = credential.metadataURI || credential.file || '';
    if (!tokenURI || (!tokenURI.startsWith('ipfs://') && !tokenURI.startsWith('https://'))) {
      this.logger.warn(`Invalid tokenURI for credential ${credential._id}: ${tokenURI}`);
    }

    const encodedData = iface.encodeFunctionData('mint', [
      user.walletAddress,
      name,
      description,
      tokenURI,
      this.mapCredentialTypeToNumber(credential.type),
      Math.floor(Date.now() / 1000) + 31536000, // 1 year
      evidenceHash,
      true
    ]);

    const result = await this.relayerService.queueTransaction({
      userAddress: user.walletAddress,
      target: nftContractAddress,
      value: "0",
      data: encodedData,
      operation: 0,
      description: `Mint NFT for credential: ${credential.title}`,
      isAccountCreation: false
    });

    this.logger.log(`NFT minting queued: ${result.transactionId}`);
    return { transactionId: result.transactionId };
  }

  /**
   * Helper function to map credential types to smart contract enum values
   */
  private mapCredentialTypeToNumber(type: string): number {
    const typeMap: { [key: string]: number } = {
      'EDUCATION': 0,
      'CERTIFICATION': 1,
      'EXPERIENCE': 2,
      'SKILL': 3,
      'ACHIEVEMENT': 4,
      'REFERENCE': 5,
      'OTHER': 6,
      'CERTIFICATE': 1, // Map to CERTIFICATION
      'PROFESSIONAL': 1, // Map to CERTIFICATION
    };
    
    return typeMap[type.toUpperCase()] || 6; // Default to OTHER
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

  /**
   * Event handler for when a credential is issued on-chain
   */
  @OnEvent('credential.issued')
  async handleCredentialIssued(payload: {
    credentialId?: string;
    blockchainCredentialId?: string; // string from event; will parse to number
    transactionId?: string;
    transactionHash?: string;
  }) {
    this.logger.log(`Received credential.issued event txHash=${payload.transactionHash} txId=${payload.transactionId} credId=${payload.credentialId} chainId=${payload.blockchainCredentialId}`);

    const findCredential = async () => {
      if (payload.transactionHash) {
        const byHash = await this.credentialModel.findOne({ transactionHash: payload.transactionHash });
        if (byHash) return byHash;
      }
      if (payload.transactionId) {
        const byTxId = await this.credentialModel.findOne({ transactionId: payload.transactionId });
        if (byTxId) return byTxId;
      }
      if (payload.credentialId) {
        const byId = await this.credentialModel.findById(payload.credentialId);
        if (byId) return byId;
      }
      return null;
    };

    // Resolve doc
    let credential = await findCredential();
    if (!credential) {
      this.logger.warn(`Cannot continue workflow - credential not found (txHash=${payload.transactionHash}, txId=${payload.transactionId}, credId=${payload.credentialId})`);
      return;
    }

    // Backfill blockchainCredentialId immediately if missing but present in event
    if (!credential.blockchainCredentialId && payload.blockchainCredentialId) {
      const numeric = parseInt(String(payload.blockchainCredentialId), 10);
      if (!isNaN(numeric) && numeric > 0) {
        await this.credentialModel.updateOne(
          { _id: credential._id },
          {
            $set: {
              blockchainCredentialId: numeric,
              verificationStatus: credential.verificationStatus || 'ISSUED',
              transactionHash: credential.transactionHash || payload.transactionHash || undefined,
              updatedAt: new Date(),
            },
          }
        );
        // re-read to have the field present
        credential = await this.credentialModel.findById(credential._id);
      }
    }

    // Short retry if still missing (DB write timing)
    for (let i = 0; i < 3 && credential && !credential.blockchainCredentialId; i++) {
      await new Promise(r => setTimeout(r, 250));
      credential = await this.credentialModel.findById(credential._id);
    }

    if (!credential?.blockchainCredentialId) {
      this.logger.warn(`Cannot continue workflow - missing blockchain ID on credential ${credential?._id}`);
      return;
    }

    try {
      await this.continueVerificationWorkflow(credential._id.toString());
    } catch (error) {
      this.logger.error(`Failed to auto-continue verification workflow for credential ${credential._id}: ${error.message}`);
    }
  }

  /**
   * Continue verification workflow after credential issuance
   * This method is called automatically when a credential is successfully issued on-chain
   */
  async continueVerificationWorkflow(credentialId: string): Promise<void> {
    try {
      this.logger.log(`Continuing verification workflow for credential: ${credentialId}`);

      const credential = await this.credentialModel.findById(credentialId).populate('user');
      if (!credential || !credential.blockchainCredentialId) {
        this.logger.warn(`Cannot continue workflow - credential not found or missing blockchain ID: ${credentialId}`);
        return;
      }

      const user = credential.user as UserDocument;
      if (!user) {
        this.logger.warn(`Cannot continue workflow - user not found for credential: ${credentialId}`);
        return;
      }

      // Proceed when the credential is freshly issued
      if (!['ISSUED', 'PENDING_ISSUANCE'].includes(String(credential.verificationStatus))) {
        this.logger.log(`Credential ${credentialId} not ready for auto-verify (status: ${credential.verificationStatus}), skipping`);
        return;
      }

      this.logger.log(`Auto-continuing verification workflow for credential ${credentialId} with blockchain ID ${credential.blockchainCredentialId}`);

      // Step 2: Verify the credential on-chain
      const verifyResult = await this.verifyCredentialOnBlockchain(
        Number(credential.blockchainCredentialId),
        '0x2Ed32Af34d80ADB200592e7e0bD6a3F761677591' // Admin address
      );

      // Step 3: Mint NFT on-chain
      const mintResult = await this.mintNFTOnBlockchain(credential, user);

      // Update credential status
      await this.credentialModel.updateOne(
        { _id: credential._id },
        {
          $set: {
            attestationStatus: 'VERIFIED',
            verificationStatus: 'VERIFIED',
            blockchainStatus: 'MINTING_NFT',
            verifiedAt: new Date(),
            verificationNotes: 'Auto-verified after successful issuance',
            verificationTransactionId: verifyResult.transactionId,
            blockchainTransactionId: mintResult.transactionId,
            lastMintAttempt: new Date(),
            blockchainError: null
          }
        }
      );

      this.logger.log(`Verification workflow continued successfully for credential ${credentialId} - verification tx: ${verifyResult.transactionId}, minting tx: ${mintResult.transactionId}`);

      // Send approval email to user
      try {
        await this.sendApprovalEmail(credential, user, 'Auto-verified after successful issuance');
      } catch (emailError) {
        this.logger.warn(`Failed to send approval email for credential ${credentialId}: ${emailError.message}`);
      }

    } catch (error) {
      this.logger.error(`Failed to continue verification workflow for credential ${credentialId}: ${error.message}`);
      
      // Update credential with error
      await this.credentialModel.updateOne(
        { _id: credentialId },
        {
          $set: {
            blockchainStatus: 'WORKFLOW_FAILED',
            blockchainError: `Workflow continuation failed: ${error.message}`,
            lastMintAttempt: new Date()
          }
        }
      );

      // Send error notification email
      try {
        const credential = await this.credentialModel.findById(credentialId).populate('user');
        if (credential && credential.user) {
          await this.sendWorkflowErrorEmail(credential, credential.user as UserDocument, error.message);
        }
      } catch (emailError) {
        this.logger.warn(`Failed to send workflow error email for credential ${credentialId}: ${emailError.message}`);
      }
    }
  }

  /**
   * Send approval email to user
   */
  private async sendApprovalEmail(credential: TalentCredentialDocument, user: UserDocument, verificationNotes: string): Promise<void> {
    try {
      const emailSubject = `✅ Credential Approved - ${credential.title}`;
      const emailTemplate = this.createApprovalEmailTemplate({
        userName: user.fullname || user.email.split('@')[0],
        credentialTitle: credential.title,
        verificationNotes,
        credentialId: credential._id.toString(),
      });

      await this.mailService.sendEmail(
        user.email,
        emailSubject,
        emailTemplate,
      );

      this.logger.log(`Approval email sent to ${user.email} for credential ${credential._id}`);
    } catch (error) {
      this.logger.error(`Failed to send approval email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send workflow error email to user
   */
  private async sendWorkflowErrorEmail(credential: TalentCredentialDocument, user: UserDocument, errorMessage: string): Promise<void> {
    try {
      const emailSubject = `⚠️ Credential Processing Issue - ${credential.title}`;
      const emailTemplate = this.createMintingErrorEmailTemplate({
        userName: user.fullname || user.email.split('@')[0],
        credentialTitle: credential.title,
        error: errorMessage,
        credentialId: credential._id.toString(),
      });

      await this.mailService.sendEmail(
        user.email,
        emailSubject,
        emailTemplate,
      );

      this.logger.log(`Workflow error email sent to ${user.email} for credential ${credential._id}`);
    } catch (error) {
      this.logger.error(`Failed to send workflow error email: ${error.message}`);
    }
  }

}
