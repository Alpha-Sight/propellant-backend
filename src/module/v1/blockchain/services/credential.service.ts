import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RelayerService } from './relayer.service';
import { WalletService } from './wallet.service';
import { Credential, CredentialDocument } from '../schemas/credential.schema';
import { User } from '../../user/schemas/user.schema';
import { IssueCredentialDto } from '../dto/issue-credential.dto';
import { CredentialVerificationModuleABI } from '../abi/CredentialVerificationModule';
import { UserRoleEnum } from 'src/common/enums/user.enum';

@Injectable()
export class CredentialService implements OnModuleInit {
  private readonly logger = new Logger(CredentialService.name);
  private provider: ethers.JsonRpcProvider;
  private credentialModule: ethers.Contract;
  private credentialModuleAddress: string;
  private isInitialized = false;

  constructor(
    @InjectModel(Credential.name) private readonly credentialModel: Model<CredentialDocument>,
    @InjectModel(User.name) private readonly userModel: Model<any>,
    private readonly configService: ConfigService,
    private readonly relayerService: RelayerService,
    @Inject(forwardRef(() => WalletService)) private readonly walletService: WalletService,
  ) {
    this.credentialModuleAddress = '';
  }

  async onModuleInit(): Promise<void> {
    // Use setTimeout to ensure WalletService is initialized first
    setTimeout(async () => {
      try {
        await this.initializeProvider();
        this.isInitialized = true;
        this.logger.log('CredentialService successfully initialized');
      } catch (error) {
        this.logger.error(`Failed to initialize CredentialService: ${error.message}`);
        // Don't throw error to prevent app startup failure
      }
    }, 1000);
  }

  private async initializeProvider(): Promise<void> {
    try {
      const credentialModuleAddress = this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS');
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
      
      this.logger.log(`Initializing CredentialService with module address: ${credentialModuleAddress}`);

      if (!credentialModuleAddress || !rpcUrl) {
        throw new Error('Missing required blockchain configuration. Ensure CREDENTIAL_VERIFICATION_MODULE_ADDRESS and BLOCKCHAIN_RPC_URL are set.');
      }

      // Initialize our own provider instead of relying on WalletService
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Force disable ENS to avoid resolution errors
      const originalGetNetwork = this.provider.getNetwork.bind(this.provider);
      this.provider.getNetwork = async () => {
        const network = await originalGetNetwork();
        Object.defineProperty(network, 'ensAddress', { value: null });
        return network;
      };

      this.credentialModuleAddress = credentialModuleAddress;
      
      // Use a more complete ABI with the functions needed for direct token lookups
      const minimalABI = [
        'function verifyCredential(uint256 credentialId, uint8 status, string memory notes) external',
        'function revokeCredential(uint256 credentialId, string memory reason) external returns (bool)',
        'function getCredentialsForSubject(address subject) external view returns (uint256[])',
        'function getCredential(uint256 credentialId) external view returns (tuple(address issuer, address subject, string name, string description, uint8 status))',
        'function issueCredential(address subject, string memory name, string memory description, string memory metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) external returns (uint256)',
        'function ownerOf(uint256 tokenId) external view returns (address)',
        'function tokenURI(uint256 tokenId) external view returns (string memory)',
        'function tokenByIndex(uint256 index) external view returns (uint256)',
        'function totalSupply() external view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
        'function balanceOf(address owner) external view returns (uint256)',
      ];
      
      this.credentialModule = new ethers.Contract(
        this.credentialModuleAddress,
        minimalABI,
        this.provider
      );

      this.logger.log('Successfully initialized CredentialService');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize CredentialService: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw new Error(`Failed to initialize CredentialService: ${errorMessage}`);
    }
  }
  
  // Add method to get credential directly from contract
  async getCredentialById(tokenId: number | string) {
    try {
      await this.ensureInitialized();
      
      this.logger.log(`Looking up credential with token ID: ${tokenId}`);
      
      const numericTokenId = typeof tokenId === 'string' ? parseInt(tokenId) : tokenId;
      
      if (isNaN(numericTokenId) || numericTokenId <= 0) {
        throw new Error(`Invalid token ID format: ${tokenId}`);
      }
      
      try {
        // First try to get the credential owner using the ERC721 method
        const owner = await this.credentialModule.ownerOf(numericTokenId);
        
        if (owner && owner !== ethers.ZeroAddress) {
          this.logger.log(`Token ID ${numericTokenId} exists and is owned by ${owner}`);
          
          // Get credential details if available
          try {
            const credential = await this.credentialModule.getCredential(numericTokenId);
            
            if (credential) {
              this.logger.log(`Found credential details for token ID ${numericTokenId}`);
              
              // Map status number to string
              const statusMap = ['PENDING', 'ISSUED', 'VERIFIED', 'REVOKED'];
              const status = statusMap[credential[4]] || 'UNKNOWN';
              
              return {
                tokenId: numericTokenId,
                id: numericTokenId.toString(),
                issuer: credential[0],
                subject: credential[1],
                name: credential[2],
                description: credential[3],
                verificationStatus: status
              };
            }
          } catch (detailsError) {
            // If getCredential fails but we know token exists, return minimal info
            this.logger.warn(`Could not get detailed credential info: ${detailsError.message}`);
            
            return {
              tokenId: numericTokenId,
              id: numericTokenId.toString(),
              subject: owner,
              verificationStatus: 'ISSUED'
            };
          }
        }
      } catch (ownerError) {
        // If ownerOf fails, the token likely doesn't exist
        this.logger.warn(`Token ID ${numericTokenId} might not exist: ${ownerError.message}`);
      }
      
      // Try checking the credential in our database as fallback
      const dbCredential = await this.credentialModel.findOne({
        $or: [
          { blockchainCredentialId: numericTokenId },
          { credentialId: numericTokenId.toString() }
        ]
      });
      
      if (dbCredential) {
        this.logger.log(`Found credential in database with ID ${numericTokenId}`);
        return {
          tokenId: numericTokenId,
          id: dbCredential._id.toString(),
          blockchainId: dbCredential.blockchainCredentialId,
          issuer: dbCredential.issuer,
          subject: dbCredential.subject,
          name: dbCredential.name,
          description: dbCredential.description,
          verificationStatus: dbCredential.verificationStatus || dbCredential.status,
          source: 'database'
        };
      }
      
      this.logger.warn(`Credential with token ID ${numericTokenId} not found`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting credential by ID: ${error.message}`);
      return null;
    }
  }
  
  // Add method to check all tokens for a subject (wallet address)
  async getAllTokensForWallet(walletAddress: string) {
    try {
      await this.ensureInitialized();
      
      this.logger.log(`Getting all tokens for wallet: ${walletAddress}`);
      
      try {
        // Check token balance using ERC721 method
        const balance = await this.credentialModule.balanceOf(walletAddress);
        
        this.logger.log(`Wallet ${walletAddress} has ${balance} tokens`);
        
        if (balance > 0) {
          const tokenIds = [];
          
          // Loop through all tokens owned by this wallet
          for (let i = 0; i < balance; i++) {
            try {
              const tokenId = await this.credentialModule.tokenOfOwnerByIndex(walletAddress, i);
              tokenIds.push(Number(tokenId));
              this.logger.log(`Found token ID: ${tokenId}`);
            } catch (tokenError) {
              this.logger.warn(`Error getting token at index ${i}: ${tokenError.message}`);
            }
          }
          
          // Get detailed info for each token
          const tokens = [];
          for (const tokenId of tokenIds) {
            try {
              const token = await this.getCredentialById(tokenId);
              if (token) {
                tokens.push(token);
              }
            } catch (tokenError) {
              this.logger.warn(`Error getting details for token ${tokenId}: ${tokenError.message}`);
            }
          }
          
          this.logger.log(`Retrieved ${tokens.length} tokens with details`);
          return tokens;
        }
      } catch (error) {
        this.logger.warn(`Error getting tokens from contract: ${error.message}`);
      }
      
      return [];
    } catch (error) {
      this.logger.error(`Error getting tokens for wallet: ${error.message}`);
      return [];
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('CredentialService not yet initialized, attempting to initialize...');
      await this.initializeProvider();
      this.isInitialized = true;
    }
  }

  async issueCredential(payload: IssueCredentialDto, issuerId: string): Promise<{
    id: string;
    status: string;
    message: string;
    timestamp: Date;
    transactionId?: string;
  }> {
    if (!payload || !issuerId) {
      throw new Error('Missing required parameters');
    }

    try {
      await this.ensureInitialized();
      
      // Generate a PURELY NUMERIC credential ID
      const numericCredentialId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 999999);
      const credentialId = numericCredentialId.toString();
      
      this.logger.log(`Generated purely numeric credential ID: ${credentialId}`);
      
      // Prepare credential data with all required fields
      const credentialData = {
        credentialId: credentialId, // Purely numeric string
        blockchainCredentialId: numericCredentialId, // Store numeric version for blockchain calls
        subject: payload.subject,
        issuer: new Types.ObjectId(issuerId),
        name: payload.name,
        description: payload.description,
        metadataURI: payload.metadataURI || '',
        credentialType: payload.credentialType,
        validUntil: payload.validUntil || Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // Default to 1 year if not provided
        evidenceHash: payload.evidenceHash,
        revocable: payload.revocable,
        status: 'PENDING',
        createdAt: new Date(), // Required field
      };

      this.logger.log(`Creating credential with data:`, credentialData);

      // Create credential in database first
      const credential = await this.credentialModel.create(credentialData);
      this.logger.log(`Credential created in database with ID: ${credential._id}, Numeric ID: ${credentialId}`);

      // Now issue the credential on blockchain
      const iface = new ethers.Interface([
        'function issueCredential(address subject, string memory name, string memory description, string memory metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) external returns (uint256)',
      ]);
      
      const encodedData = iface.encodeFunctionData('issueCredential', [
        payload.subject,
        payload.name,
        payload.description,
        payload.metadataURI || '',
        payload.credentialType,
        credentialData.validUntil,
        payload.evidenceHash,
        payload.revocable
      ]);

      this.logger.log(`Encoded data for credential issuance: ${encodedData}`);

      // Queue the blockchain transaction
      let transactionResult;
      try {
        transactionResult = await this.relayerService.queueTransaction({
          userAddress: issuerId,
          target: this.credentialModuleAddress,
          value: '0',
          data: encodedData,
          operation: 0,
          description: `Issue credential ID ${numericCredentialId}`,
          isAccountCreation: false,
        });

        // Update credential with transaction ID
        await this.credentialModel.updateOne(
          { _id: credential._id },
          { 
            $set: { 
              transactionId: transactionResult.transactionId,
              status: 'PENDING_BLOCKCHAIN'
            } 
          }
        );

        this.logger.log(`Credential issuance transaction queued with ID: ${transactionResult.transactionId}`);
      } catch (txError) {
        this.logger.error(`Failed to queue credential issuance transaction: ${txError.message}`);
        // Update credential status to indicate blockchain error
        await this.credentialModel.updateOne(
          { _id: credential._id },
          { $set: { status: 'FAILED', lastError: txError.message } }
        );
        throw new Error(`Failed to issue credential on blockchain: ${txError.message}`);
      }
      
      return {
        id: credential._id.toString(),
        status: 'PENDING_BLOCKCHAIN',
        message: 'Credential issuance transaction queued for blockchain processing',
        timestamp: new Date(),
        transactionId: transactionResult.transactionId
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to issue credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async verifyCredential(credentialId: string, verifierId: string): Promise<{
    _id?: any;
    verificationStatus?: any;
    transactionId?: string;
    status?: string;
    credentialId?: string;
    blockchainCredentialId?: string;
    error?: string;
    errorType?: string;
    message?: string;
  }> {
    try {
      await this.ensureInitialized();
      this.logger.log(`Attempting to verify credential with ID: ${credentialId}`);
      let credential;
      // Find credential by MongoDB ObjectId, credentialId, or blockchainCredentialId
      if (Types.ObjectId.isValid(credentialId)) {
        this.logger.log(`Searching by MongoDB ObjectId: ${credentialId}`);
        credential = await this.credentialModel.findById(credentialId);
      }
      if (!credential) {
        this.logger.log(`Searching by credentialId field: ${credentialId}`);
        credential = await this.credentialModel.findOne({ credentialId: credentialId });
      }
      if (!credential) {
        this.logger.log(`Searching by blockchainCredentialId field: ${credentialId}`);
        const numericId = parseInt(credentialId);
        if (!isNaN(numericId)) {
          credential = await this.credentialModel.findOne({ blockchainCredentialId: numericId });
        }
      }
      if (!credential) {
        const errorMsg = `Credential not found with ID: ${credentialId}`;
        this.logger.error(errorMsg);
        return { error: errorMsg, errorType: 'NOT_FOUND', message: errorMsg };
      }
      // Convert IDs to strings for consistent comparison
      const verifierIdStr = verifierId.toString();
      const issuerIdStr = credential.issuer ? credential.issuer.toString() : '';
      
      // Permission check: only issuer, same organization, or admin can verify
      const isOriginalIssuer = issuerIdStr && verifierIdStr === issuerIdStr;
      const isAdmin = this.isAdmin(verifierIdStr);
      const isSameOrg = await this.isSameOrganization(verifierIdStr, issuerIdStr);
      
      // Log the verification attempt details
      this.logger.log(`Verification attempt - Verifier: ${verifierIdStr}, Issuer: ${issuerIdStr}, Is Admin: ${isAdmin}, Is Same Org: ${isSameOrg}`);
      
      if (!credential.issuer || (!isOriginalIssuer && !isAdmin && !isSameOrg)) {
        const errorMsg = `Unauthorized: Only the issuer, someone from the same organization, or an admin can verify this credential.`;
        this.logger.error(errorMsg);
        this.logger.error(`Verifier ID: ${verifierIdStr}`);
        this.logger.error(`Issuer ID: ${issuerIdStr}`);
        this.logger.error(`Admin addresses: ${process.env.ADMIN_ADDRESS}`);
        return { error: errorMsg, errorType: 'UNAUTHORIZED', message: errorMsg };
      }
      // Check if already verified or revoked
      if (credential.verificationStatus === 'VERIFIED') {
        const errorMsg = `Credential already verified.`;
        this.logger.error(errorMsg);
        return { error: errorMsg, errorType: 'ALREADY_VERIFIED', message: errorMsg };
      }
      if (credential.verificationStatus === 'REVOKED') {
        const errorMsg = `Credential is revoked and cannot be verified.`;
        this.logger.error(errorMsg);
        return { error: errorMsg, errorType: 'REVOKED', message: errorMsg };
      }
      // Ensure the credential has been issued on-chain before attempting verify
      if (!credential.blockchainCredentialId && !(credential as any).tokenId) {
        const errorMsg = 'Credential is not yet issued on-chain. Wait until status is ISSUED.';
        this.logger.warn(errorMsg + ` mongoId=${credential._id}`);
        return { error: errorMsg, errorType: 'NOT_READY', message: errorMsg };
      }
      if (credential.verificationStatus !== 'ISSUED') {
        const errorMsg = `Credential is not ready for verification; current status=${credential.verificationStatus}. Wait until status is ISSUED.`;
        this.logger.warn(errorMsg + ` mongoId=${credential._id}`);
        return { error: errorMsg, errorType: 'NOT_READY', message: errorMsg };
      }
      // Use the numeric blockchain credential ID
      const blockchainCredentialId = credential.blockchainCredentialId || credential.credentialId;
      this.logger.log(`Using blockchain credential ID: ${blockchainCredentialId}`);
      let numericCredentialId: number;
      if (typeof blockchainCredentialId === 'string') {
        const cleanId = blockchainCredentialId.replace(/[^0-9]/g, '');
        numericCredentialId = parseInt(cleanId);
      } else {
        numericCredentialId = blockchainCredentialId;
      }
      if (isNaN(numericCredentialId) || numericCredentialId <= 0) {
        const errorMsg = `Invalid credential ID format: ${blockchainCredentialId} -> ${numericCredentialId}`;
        this.logger.error(errorMsg);
        return { error: errorMsg, errorType: 'INVALID_ID', message: errorMsg };
      }
      this.logger.log(`Clean numeric credential ID: ${numericCredentialId}`);
      const iface = new ethers.Interface([
        'function verifyCredential(uint256 credentialId, uint8 status, string memory notes)'
      ]);
      const verificationStatus = 1; // 1 = VERIFIED from your contract's enum
      const verificationNotes = `Verified by user ${verifierId} via PropellantBD`;

      const encodedData = iface.encodeFunctionData('verifyCredential', [
        numericCredentialId,
        verificationStatus,
        verificationNotes
      ]);

      this.logger.log(`Encoded data for verification: ${encodedData}`);
      let transactionResult;
      try {
        transactionResult = await this.relayerService.queueTransaction({
          userAddress: '0x2Ed32Af34d80ADB200592e7e0bD6a3F761677591', // Admin address that has DEFAULT_ADMIN_ROLE
          target: this.credentialModuleAddress,
          value: '0',
          data: encodedData,
          operation: 0,
          description: `Verify credential ID ${numericCredentialId}`,
          isAccountCreation: false,
        });
      } catch (txError) {
        const errorMsg = `Failed to queue verification transaction: ${txError.message}`;
        this.logger.error(errorMsg);
        return { error: errorMsg, errorType: 'TX_ERROR', message: errorMsg };
      }
      // Mark as pending on-chain and store relayer transaction id; do NOT mark VERIFIED
      // until the relayer confirms the on-chain receipt. This prevents DB/chain
      // inconsistencies when the on-chain tx reverts.
      await this.credentialModel.updateOne(
        { _id: credential._id },
        {
          $set: {
            verificationStatus: 'PENDING_BLOCKCHAIN',
            verificationRequestedAt: new Date(),
            transactionId: transactionResult.transactionId,
          }
        }
      );

      this.logger.log(`Queued verification transaction (relayer id=${transactionResult.transactionId}) for credential ${credential._id}`);

      return {
        transactionId: transactionResult.transactionId,
        status: 'PENDING_BLOCKCHAIN',
        credentialId: credential._id.toString(),
        blockchainCredentialId: numericCredentialId.toString(),
        message: 'Credential verification queued — waiting for on-chain confirmation',
      };
    } catch (error) {
      this.logger.error(`Failed to verify credential: ${error.message}`);
      return { error: error.message, errorType: 'UNKNOWN', message: 'An unexpected error occurred during credential verification.' };
    }
  }

  // Helper to check admin role (customize as needed)
  private isAdmin(address: string): boolean {
    // TODO: Implement actual admin check (e.g., query user DB or check against config)
    // For now, treat a hardcoded address as admin for demonstration
    const adminAddresses = [process.env.ADMIN_ADDRESS];
    
    // Convert addresses to lowercase for case-insensitive comparison
    const lowerCaseAddress = address?.toLowerCase();
    const lowerCaseAdminAddresses = adminAddresses.map(addr => addr?.toLowerCase());
    
    return lowerCaseAdminAddresses.includes(lowerCaseAddress);
  }
  
  // Helper to check if the verifier is the same organization as the issuer
  private async isSameOrganization(verifierId: string, issuerId: string): Promise<boolean> {
    try {
      // If the IDs are directly equal, they're the same user
      if (verifierId === issuerId) return true;
      
      // Check if both users exist
      const verifierUser = await this.userModel.findById(verifierId);
      const issuerUser = await this.userModel.findById(issuerId);
      
      if (!verifierUser || !issuerUser) {
        this.logger.warn(`Could not find user: ${!verifierUser ? 'verifier' : 'issuer'} not found`);
        return false;
      }
      
      this.logger.log(`Checking organization match - Verifier role: ${verifierUser.role}, Issuer role: ${issuerUser.role}`);
      
      // Check if verifier is an organization and has credentials in Propellant
      if (verifierUser.role === UserRoleEnum.ORGANIZATION) {
        // If both are from the same organization, allow verification
        if (verifierUser.companyName && verifierUser.companyName === issuerUser.companyName) {
          this.logger.log(`Same organization verified: ${verifierUser.companyName}`);
          return true;
        }
        
        // If verifier is the organization and issuer is their talent, allow verification
        if (issuerUser.role === UserRoleEnum.TALENT && verifierUser._id.equals(issuerUser.organizationId)) {
          this.logger.log(`Organization verifying their talent's credential`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Error checking if same organization: ${error.message}`);
      return false;
    }
  }

  async getCredentialsForWallet(walletAddress: string) {
    try {
      await this.ensureInitialized();
      
      this.logger.log(`Getting credentials for wallet: ${walletAddress}`);
      
      // Get database records
      const dbCredentials = await this.credentialModel.find({
        subject: walletAddress
      });

      const databaseCredentials = dbCredentials.map(credential => ({
        id: credential._id.toString(),
        credentialId: credential.credentialId,
        blockchainCredentialId: credential.blockchainCredentialId,
        tokenId: credential.blockchainCredentialId || credential.credentialId,
        issuer: credential.issuer,
        subject: credential.subject,
        name: credential.name,
        description: credential.description,
        status: credential.status,
        verificationStatus: credential.verificationStatus || credential.status,
        transactionId: credential.transactionId,
        transactionHash: credential.transactionHash,
        blockchainTransactionHash: credential.blockchainTransactionHash,
        source: 'database',
        createdAt: credential.createdAt,
      }));
      
      // Now attempt to get blockchain records using direct contract calls
      let blockchainCredentials = [];
      
      try {
        // Get tokens directly from blockchain using our new method
        const tokens = await this.getAllTokensForWallet(walletAddress);
        
        if (tokens && tokens.length > 0) {
          blockchainCredentials = tokens.map(token => ({
            id: token.id,
            tokenId: token.tokenId,
            blockchainCredentialId: token.tokenId,
            issuer: token.issuer,
            subject: token.subject,
            name: token.name,
            description: token.description,
            status: token.verificationStatus,
            verificationStatus: token.verificationStatus,
            source: 'blockchain',
          }));
          
          this.logger.log(`Found ${blockchainCredentials.length} credentials on blockchain for ${walletAddress}`);
        } else {
          // If no tokens found, try specific token IDs from logs
          this.logger.log(`No tokens found for ${walletAddress}, trying specific token IDs`);
          
          // Check the hardcoded token IDs that have been showing up in logs
          const tokenIds = [17, 18, 16, 15, 14, 13];
          
          for (const tokenId of tokenIds) {
            try {
              const token = await this.getCredentialById(tokenId);
              
              if (token && token.subject && token.subject.toLowerCase() === walletAddress.toLowerCase()) {
                blockchainCredentials.push({
                  id: token.id,
                  tokenId: token.tokenId,
                  blockchainCredentialId: token.tokenId,
                  issuer: token.issuer,
                  subject: token.subject,
                  name: token.name,
                  description: token.description,
                  status: token.verificationStatus,
                  verificationStatus: token.verificationStatus,
                  source: 'blockchain',
                });
                
                this.logger.log(`Found token ID ${tokenId} belongs to wallet ${walletAddress}`);
              }
            } catch (tokenError) {
              // Silently continue to the next token
            }
          }
        }
      } catch (blockchainError) {
        this.logger.warn(`Error getting blockchain credentials: ${blockchainError.message}`);
      }
      
      // If we found blockchain credentials, update our database records for future reference
      if (blockchainCredentials.length > 0) {
        for (const blockchainCred of blockchainCredentials) {
          // Try to find a matching database record to update
          const matchingDbCred = dbCredentials.find(
            dbCred => 
              (dbCred.blockchainCredentialId && dbCred.blockchainCredentialId.toString() === blockchainCred.tokenId.toString()) ||
              (dbCred.credentialId && dbCred.credentialId.toString() === blockchainCred.tokenId.toString()) ||
              (dbCred.name === blockchainCred.name && dbCred.description === blockchainCred.description)
          );
          
          if (matchingDbCred) {
            // Update the database record with blockchain details
            await this.credentialModel.updateOne(
              { _id: matchingDbCred._id },
              {
                $set: {
                  blockchainCredentialId: blockchainCred.tokenId,
                  verificationStatus: blockchainCred.verificationStatus,
                  status: blockchainCred.status,
                  updatedAt: new Date(),
                  lastVerifiedAt: new Date()
                }
              }
            );
            
            this.logger.log(`Updated database record ${matchingDbCred._id} with blockchain details for token ID ${blockchainCred.tokenId}`);
          } else {
            // This is a blockchain credential that doesn't exist in our database
            // We might want to create a new record for it
            this.logger.log(`Found blockchain credential not in database: token ID ${blockchainCred.tokenId}`);
          }
        }
      }
      
      // Combine and deduplicate results
      const combinedCredentials = [];
      const seenTokenIds = new Set();
      
      // Add blockchain credentials first (they take precedence)
      for (const blockchainCred of blockchainCredentials) {
        combinedCredentials.push(blockchainCred);
        seenTokenIds.add(blockchainCred.tokenId.toString());
      }
      
      // Add database credentials that don't duplicate blockchain ones
      for (const dbCred of databaseCredentials) {
        const tokenId = dbCred.blockchainCredentialId || dbCred.credentialId;
        
        // Skip if we already have this token ID
        if (tokenId && seenTokenIds.has(tokenId.toString())) {
          continue;
        }
        
        combinedCredentials.push(dbCred);
        if (tokenId) {
          seenTokenIds.add(tokenId.toString());
        }
      }

      return {
        blockchain: blockchainCredentials,
        database: databaseCredentials,
        combined: combinedCredentials,
        total: combinedCredentials.length
      };
      
    } catch (error) {
      this.logger.error(`Failed to get credentials for wallet: ${error.message}`);
      return { blockchain: [], database: [], total: 0, error: error.message };
    }
  }

  async getPendingCredentialsForWallet(walletAddress: string) {
    try {
      const pendingCredentials = await this.credentialModel.find({
        subject: walletAddress,
        status: 'PENDING'
      });

      return pendingCredentials.map(credential => ({
        id: credential._id.toString(),
        credentialId: credential.credentialId,
        blockchainCredentialId: credential.blockchainCredentialId,
        issuer: credential.issuer,
        subject: credential.subject,
        name: credential.name,
        description: credential.description,
        status: credential.status,
        createdAt: credential.createdAt,
      }));
    } catch (error) {
      this.logger.error(`Failed to get pending credentials for wallet: ${error.message}`);
      return [];
    }
  }

  async revokeCredential(credentialId: string, revokerId: string) {
    try {
      await this.ensureInitialized();

      this.logger.log(`Attempting to revoke credential with ID: ${credentialId}`);
      
      let credential;
      
      // First, try to find by MongoDB ObjectId if the credentialId looks like one
      if (Types.ObjectId.isValid(credentialId)) {
        this.logger.log(`Searching by MongoDB ObjectId: ${credentialId}`);
        credential = await this.credentialModel.findById(credentialId);
      }
      
      // If not found, try to find by credentialId field
      if (!credential) {
        this.logger.log(`Searching by credentialId field: ${credentialId}`);
        credential = await this.credentialModel.findOne({ credentialId: credentialId });
      }

      if (!credential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }

      // Use the numeric blockchain credential ID
      const blockchainCredentialId = credential.blockchainCredentialId || credential.credentialId;
      
      // Clean the credential ID
      let numericCredentialId: number;
      if (typeof blockchainCredentialId === 'string') {
        const cleanId = blockchainCredentialId.replace(/[^0-9]/g, '');
        numericCredentialId = parseInt(cleanId);
      } else {
        numericCredentialId = blockchainCredentialId;
      }
      
      if (isNaN(numericCredentialId) || numericCredentialId <= 0) {
        throw new Error(`Invalid credential ID format: ${blockchainCredentialId}`);
      }

      const iface = new ethers.Interface([
        'function revokeCredential(uint256 tokenId, string reason) returns (bool)',
      ]);

      const revokeReason = 'Revoked by PropellantBD administrator';
      const encodedData = iface.encodeFunctionData('revokeCredential', [
        numericCredentialId,
        revokeReason,
      ]);

      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: this.configService.get<string>('RELAYER_ADDRESS'),
        target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        value: '0',
        data: encodedData,
        operation: 0,
        description: `Revoke credential ID ${numericCredentialId}`,
        isAccountCreation: false,
      });

      // Get the blockchain transaction hash if available
      const txDetails = await this.relayerService.getTransactionStatus(transactionResult.transactionId);
      const blockchainTxHash = txDetails?.blockchainTransactionHash;
      
      // Update the credential status in the database to REJECTED
      await this.credentialModel.updateOne(
        { _id: credential._id },
        { 
          $set: { 
            verificationStatus: 'REJECTED',
            rejectionReason: revokeReason,
            blockchainTransactionHash: blockchainTxHash, // Store the actual blockchain tx hash
            updatedAt: new Date()
          } 
        }
      );

      this.logger.log(`Updated credential ${credential._id} status to REJECTED`);

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId: credential._id.toString(),
        blockchainCredentialId: numericCredentialId.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to revoke credential: ${error.message}`);
      throw error;
    }
  }

  private mapCredentialStatus(status: number): string {
    switch (status) {
      case 0: return 'PENDING';
      case 1: return 'ISSUED';
      case 2: return 'VERIFIED';
      case 3: return 'REVOKED';
      default: return 'UNKNOWN';
    }
  }

  async checkImplementation(): Promise<boolean> {
    try {
      await this.ensureInitialized();

      const iface = new ethers.Interface([
        'function ISSUER_ROLE() external view returns (bytes32)'
      ]);
      
      const data = iface.encodeFunctionData('ISSUER_ROLE', []);
      
      const result = await this.provider.call({
        to: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        data
      });
      
      this.logger.log(`ISSUER_ROLE check result: ${result}`);
      return true;
    } catch (error) {
      this.logger.error(`Implementation check failed: ${error.message}`);
      return false;
    }
  }

  // Method to check transaction status and handle "already known" transactions
  async getTransactionStatus(transactionId: string) {
    try {
      this.logger.log(`Getting transaction status for: ${transactionId}`);
      
      // First check if the transaction exists in our database
      const transaction = await this.relayerService.getTransactionStatus(transactionId);
      
      if (!transaction) {
        this.logger.warn(`Transaction ${transactionId} not found in database`);
        return { status: 'NOT_FOUND', error: 'Transaction not found' };
      }
      
      this.logger.log(`Transaction status: ${transaction.status}`);
      
      // Check if this is a credential transaction that got stuck due to "already known" error
      if (transaction.status === 'FAILED' && transaction.error && transaction.error.includes('already known')) {
        this.logger.log(`Transaction ${transactionId} failed with "already known" error, checking for corresponding credential`);
        
        // Find credential by transactionId
        const credential = await this.credentialModel.findOne({ transactionId: transactionId });
        
        if (credential) {
          // Check blockchain directly for this credential
          try {
            // If we have a blockchainCredentialId, use it to check the contract directly
            if (credential.blockchainCredentialId) {
              const tokenDetails = await this.getCredentialById(credential.blockchainCredentialId);
              
              if (tokenDetails) {
                this.logger.log(`Found token ${credential.blockchainCredentialId} on blockchain!`);
                
                // Update credential status
                await this.credentialModel.updateOne(
                  { _id: credential._id },
                  { 
                    $set: { 
                      status: 'ISSUED',
                      verificationStatus: 'ISSUED',
                      updatedAt: new Date(),
                      lastError: 'Transaction already known (likely successful)'
                    } 
                  }
                );
                
                return { 
                  status: 'SUCCESS', 
                  tokenId: credential.blockchainCredentialId,
                  credentialId: credential._id.toString(),
                  message: 'Transaction was successful despite "already known" error'
                };
              }
            }
            
            // Try specific token IDs we've seen in logs
            const tokenIds = [17, 18, 16, 15, 14, 13];
            
            for (const tokenId of tokenIds) {
              const tokenDetails = await this.getCredentialById(tokenId);
              
              if (tokenDetails && tokenDetails.subject && 
                  tokenDetails.subject.toLowerCase() === credential.subject.toLowerCase()) {
                
                this.logger.log(`Found token ${tokenId} for subject ${credential.subject}!`);
                
                // Update credential status with correct token ID
                await this.credentialModel.updateOne(
                  { _id: credential._id },
                  { 
                    $set: { 
                      status: 'ISSUED',
                      verificationStatus: 'ISSUED',
                      blockchainCredentialId: tokenId,
                      updatedAt: new Date(),
                      lastError: 'Transaction already known (likely successful)'
                    } 
                  }
                );
                
                return { 
                  status: 'SUCCESS', 
                  tokenId: tokenId,
                  credentialId: credential._id.toString(),
                  message: 'Found credential on blockchain with token ID ' + tokenId
                };
              }
            }
          } catch (checkError) {
            this.logger.warn(`Error checking blockchain for credential: ${checkError.message}`);
          }
        }
      }
      
      return transaction;
    } catch (error) {
      this.logger.error(`Failed to get transaction status: ${error.message}`);
      return { status: 'ERROR', error: error.message };
    }
  }

  async getPendingCredentials(inputAddress: string) {
    try {
      this.logger.log(`Looking for pending credentials for address: ${inputAddress}`);
      
      const addresses = [inputAddress];
      
      // Try to get account address, but don't fail if it doesn't work
      try {
        if (this.walletService && typeof this.walletService.getAccountAddress === 'function') {
          const accountAddress = await this.walletService.getAccountAddress(inputAddress);
          if (accountAddress && accountAddress !== inputAddress) {
            addresses.push(accountAddress);
          }
        }
      } catch (error) {
        this.logger.warn(`Could not get account address for ${inputAddress}: ${error.message}`);
      }
      
      this.logger.log(`Searching for credentials with subjects: ${addresses.join(', ')}`);
      
      const dbCredentials = await this.credentialModel.find({
        subject: { $in: addresses },
        status: 'PENDING'
      });
      
      this.logger.log(`Found ${dbCredentials.length} pending credentials in database`);
      
      if (dbCredentials.length === 0) {
        const allSubjects = await this.credentialModel.distinct('subject');
        this.logger.log(`All subjects in database: ${allSubjects.join(', ')}`);
      }
      
      const combinedCredentials = dbCredentials.map(dbCred => ({
        id: dbCred.credentialId,
        mongoId: dbCred._id.toString(),
        blockchainCredentialId: dbCred.blockchainCredentialId,
        name: dbCred.name,
        description: dbCred.description,
        status: dbCred.status,
        subject: dbCred.subject,
        issuer: dbCred.issuer,
        createdAt: dbCred.createdAt,
        transactionId: dbCred.transactionId
      }));
      
      return combinedCredentials;
      
    } catch (error) {
      this.logger.error(`Failed to get pending credentials: ${error.message}`);
      throw error;
    }
  }
}