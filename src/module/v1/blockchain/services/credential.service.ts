import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RelayerService } from './relayer.service';
import { WalletService } from './wallet.service';
import { Credential, CredentialDocument } from '../schemas/credential.schema';
import { IssueCredentialDto } from '../dto/issue-credential.dto';
import { CredentialVerificationModuleABI } from '../abi/CredentialVerificationModule';

@Injectable()
export class CredentialService implements OnModuleInit {
  private readonly logger = new Logger(CredentialService.name);
  private provider: ethers.JsonRpcProvider;
  private credentialModule: ethers.Contract;
  private credentialModuleAddress: string;
  private isInitialized = false;

  constructor(
    @InjectModel(Credential.name) private readonly credentialModel: Model<CredentialDocument>,
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
      
      // Use a minimal ABI with only the functions we actually need
      const minimalABI = [
        'function verifyCredential(uint256 credentialId) external returns (bool)',
        'function revokeCredential(uint256 credentialId, string memory reason) external returns (bool)',
        'function getCredentialsForSubject(address subject) external view returns (uint256[])',
        'function getCredential(uint256 credentialId) external view returns (tuple(address issuer, address subject, string name, string description, uint8 status))',
        'function issueCredential(address subject, string memory name, string memory description, string memory metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) external returns (uint256)',
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
  }> {
    if (!payload || !issuerId) {
      throw new Error('Missing required parameters');
    }

    try {
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

      // Create credential without transaction (since MongoDB standalone doesn't support transactions)
      const credential = await this.credentialModel.create(credentialData);
      
      this.logger.log(`Credential created successfully with ID: ${credential._id}, Numeric ID: ${credentialId}`);
      
      return {
        id: credential._id.toString(),
        status: 'PENDING',
        message: 'Credential issuance request received and stored in database',
        timestamp: new Date()
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to issue credential: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async verifyCredential(credentialId: string, verifierAddress: string): Promise<{
    transactionId: string;
    status: string;
    credentialId: string;
    blockchainCredentialId?: string;
  }> {
    try {
      await this.ensureInitialized();

      this.logger.log(`Attempting to verify credential with ID: ${credentialId}`);
      
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
      
      // If still not found, try to find by blockchainCredentialId
      if (!credential) {
        this.logger.log(`Searching by blockchainCredentialId field: ${credentialId}`);
        const numericId = parseInt(credentialId);
        if (!isNaN(numericId)) {
          credential = await this.credentialModel.findOne({ blockchainCredentialId: numericId });
        }
      }

      if (!credential) {
        throw new Error(`Credential not found with ID: ${credentialId}`);
      }

      this.logger.log(`Found credential: ${JSON.stringify({
        _id: credential._id,
        credentialId: credential.credentialId,
        blockchainCredentialId: credential.blockchainCredentialId,
        name: credential.name
      })}`);

      // Use the numeric blockchain credential ID
      const blockchainCredentialId = credential.blockchainCredentialId || credential.credentialId;
      
      this.logger.log(`Using blockchain credential ID: ${blockchainCredentialId}`);

      // Ensure the credential ID is numeric and clean
      let numericCredentialId: number;
      if (typeof blockchainCredentialId === 'string') {
        // Remove any non-numeric characters
        const cleanId = blockchainCredentialId.replace(/[^0-9]/g, '');
        numericCredentialId = parseInt(cleanId);
      } else {
        numericCredentialId = blockchainCredentialId;
      }
      
      if (isNaN(numericCredentialId) || numericCredentialId <= 0) {
        throw new Error(`Invalid credential ID format: ${blockchainCredentialId} -> ${numericCredentialId}`);
      }

      this.logger.log(`Clean numeric credential ID: ${numericCredentialId}`);

      const iface = new ethers.Interface([
        'function verifyCredential(uint256 credentialId) returns (bool)',
      ]);

      const encodedData = iface.encodeFunctionData('verifyCredential', [numericCredentialId]);

      this.logger.log(`Encoded data for verification: ${encodedData}`);

      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: verifierAddress,
        target: this.credentialModuleAddress,
        value: '0',
        data: encodedData,
        operation: 0,
        description: `Verify credential ID ${numericCredentialId}`,
        isAccountCreation: false,
      });

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId,
        blockchainCredentialId: numericCredentialId.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to verify credential: ${error.message}`);
      throw error;
    }
  }

  async getCredentialsForWallet(walletAddress: string) {
    try {
      // Skip blockchain calls for now since they're failing, just return database records
      this.logger.log(`Getting credentials for wallet: ${walletAddress}`);
      
      const dbCredentials = await this.credentialModel.find({
        subject: walletAddress
      });

      const databaseCredentials = dbCredentials.map(credential => ({
        id: credential._id.toString(),
        credentialId: credential.credentialId,
        blockchainCredentialId: credential.blockchainCredentialId,
        issuer: credential.issuer,
        subject: credential.subject,
        name: credential.name,
        description: credential.description,
        status: credential.status,
        source: 'database',
        createdAt: credential.createdAt,
      }));

      return {
        blockchain: [],
        database: databaseCredentials,
        total: databaseCredentials.length,
        note: 'Currently showing database records only - blockchain integration under development'
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

      const encodedData = iface.encodeFunctionData('revokeCredential', [
        numericCredentialId,
        'Revoked by PropellantBD administrator',
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

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId,
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