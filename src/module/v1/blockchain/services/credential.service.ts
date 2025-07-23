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
      // Generate a numeric credential ID (timestamp + random number)
      const numericCredentialId = Date.now() + Math.floor(Math.random() * 10000);
      const credentialId = numericCredentialId.toString();
      
      // Prepare credential data with all required fields
      const credentialData = {
        credentialId: credentialId, // Now purely numeric
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
      
      this.logger.log(`Credential created successfully with ID: ${credential._id}`);
      
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

      // Find the credential in the database first
      const credential = await this.credentialModel.findById(credentialId);
      if (!credential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }

      // Use the numeric blockchain credential ID
      const blockchainCredentialId = credential.blockchainCredentialId || credential.credentialId;
      
      this.logger.log(`Verifying credential with blockchain ID: ${blockchainCredentialId}`);

      // Ensure the credential ID is numeric
      const numericCredentialId = parseInt(blockchainCredentialId.toString());
      if (isNaN(numericCredentialId)) {
        throw new Error(`Invalid credential ID format: ${blockchainCredentialId}`);
      }

      const iface = new ethers.Interface([
        'function verifyCredential(uint256 credentialId) returns (bool)',
      ]);

      const encodedData = iface.encodeFunctionData('verifyCredential', [numericCredentialId]);

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
      // First try to get blockchain credentials
      let blockchainCredentials = [];
      
      try {
        await this.ensureInitialized();
        
        this.logger.log(`Getting credentials for wallet: ${walletAddress}`);
        
        // Try to call the contract method
        const credentialIds = await this.credentialModule.getCredentialsForSubject(walletAddress);
        
        this.logger.log(`Found ${credentialIds.length} credentials on blockchain`);
        
        for (const id of credentialIds) {
          try {
            const credential = await this.credentialModule.getCredential(id);
            blockchainCredentials.push({
              id: id.toString(),
              issuer: credential.issuer,
              subject: credential.subject,
              name: credential.name,
              description: credential.description,
              status: this.mapCredentialStatus(credential.status),
              source: 'blockchain'
            });
          } catch (error) {
            this.logger.error(`Error fetching credential ${id}: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to get blockchain credentials: ${error.message}`);
      }

      // Also get database credentials
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
        blockchain: blockchainCredentials,
        database: databaseCredentials,
        total: blockchainCredentials.length + databaseCredentials.length
      };
    } catch (error) {
      this.logger.error(`Failed to get credentials for wallet: ${error.message}`);
      // Return database credentials only if blockchain fails
      try {
        const dbCredentials = await this.credentialModel.find({
          subject: walletAddress
        });

        return {
          blockchain: [],
          database: dbCredentials.map(credential => ({
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
          })),
          total: dbCredentials.length,
          note: 'Blockchain data unavailable, showing database records only'
        };
      } catch (dbError) {
        this.logger.error(`Failed to get database credentials: ${dbError.message}`);
        return { blockchain: [], database: [], total: 0 };
      }
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

      // Find the credential in the database first
      const credential = await this.credentialModel.findById(credentialId);
      if (!credential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }

      // Use the numeric blockchain credential ID
      const blockchainCredentialId = credential.blockchainCredentialId || credential.credentialId;
      const numericCredentialId = parseInt(blockchainCredentialId.toString());
      
      if (isNaN(numericCredentialId)) {
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