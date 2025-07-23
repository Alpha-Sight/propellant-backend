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
      
      this.credentialModule = new ethers.Contract(
        this.credentialModuleAddress,
        CredentialVerificationModuleABI as any,
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
      // Generate a unique credential ID
      const credentialId = `CRED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare credential data with all required fields
      const credentialData = {
        credentialId: credentialId, // Required field
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

      const iface = new ethers.Interface([
        'function verifyCredential(uint256 credentialId) returns (bool)',
      ]);

      const encodedData = iface.encodeFunctionData('verifyCredential', [credentialId]);

      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: verifierAddress,
        target: this.credentialModuleAddress,
        value: '0',
        data: encodedData,
        operation: 0,
        description: `Verify credential ID ${credentialId}`,
        isAccountCreation: false,
      });

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId,
      };
    } catch (error) {
      this.logger.error(`Failed to verify credential: ${error.message}`);
      throw error;
    }
  }

  async getCredentialsForWallet(walletAddress: string) {
    try {
      await this.ensureInitialized();

      const credentialIds = await this.credentialModule.getCredentialsForSubject(walletAddress);
      
      if (!credentialIds.length) {
        return [];
      }

      const credentials = [];
      for (const id of credentialIds) {
        try {
          const credential = await this.credentialModule.getCredential(id);
          credentials.push({
            id: id.toString(),
            issuer: credential.issuer,
            subject: credential.subject,
            name: credential.name,
            description: credential.description,
            status: this.mapCredentialStatus(credential.status),
          });
        } catch (error) {
          this.logger.error(`Error fetching credential ${id}: ${error.message}`);
        }
      }

      return credentials;
    } catch (error) {
      this.logger.error(`Failed to get credentials for wallet: ${error.message}`);
      return [];
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

      const iface = new ethers.Interface([
        'function revokeCredential(uint256 tokenId, string reason) returns (bool)',
      ]);

      const encodedData = iface.encodeFunctionData('revokeCredential', [
        credentialId,
        'Revoked by PropellantBD administrator',
      ]);

      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: this.configService.get<string>('RELAYER_ADDRESS'),
        target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        value: '0',
        data: encodedData,
        operation: 0,
        description: `Revoke credential ID ${credentialId}`,
        isAccountCreation: false,
      });

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId,
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