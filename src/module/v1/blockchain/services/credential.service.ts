import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { RelayerService } from 'src/module/v1/blockchain/services/relayer.service';
import { IssueCredentialDto } from '../dto/mint-credential.dto';
import * as CredentialVerificationModuleABI from '../abis/CredentialVerificationModule.json';
import { WalletService } from './wallet.service';
import { Credential, CredentialDocument } from '../schemas/credential.schema';

@Injectable()
export class CredentialService implements OnModuleInit {
  private readonly logger = new Logger(CredentialService.name);
  private provider: ethers.JsonRpcProvider;
  private credentialModule: ethers.Contract;
  private credentialContract: any;

  constructor(
    private configService: ConfigService,
    private relayerService: RelayerService,
    private walletService: WalletService,
    @InjectModel(Credential.name) private credentialModel: Model<CredentialDocument>,
  ) {
    // Initialization moved to onModuleInit
  }

  async onModuleInit() {
    await this.initializeProvider();
  }

  private async initializeProvider() {
    try {
      const credentialModuleAddress = this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS');
      
      this.logger.log(`Credential Module Address from config: ${credentialModuleAddress}`);

      if (!credentialModuleAddress) {
        throw new Error('Missing blockchain configuration: Ensure CREDENTIAL_VERIFICATION_MODULE_ADDRESS is set.');
      }

      this.provider = this.walletService.getProvider();
      
      // Initialize network override for local testing
      this.provider.getNetwork = async () => {
        return {
          name: 'localhost',
          chainId: 1337,
          ensAddress: null,
          _defaultProvider: () => [this.provider]
        } as any;
      };
      
      // Initialize contract
      this.credentialModule = new ethers.Contract(
        credentialModuleAddress,
        CredentialVerificationModuleABI.abi,
        this.provider
      );
      
    } catch (error) {
      this.logger.error(`Failed to initialize provider in CredentialService: ${error.message}`);
      throw error;
    }
  }

  async issueCredential(payload: IssueCredentialDto, issuerId: string) {
    try {
      // Ensure account exists
      await this.ensureAccountExists(payload.subject);
      
      // Generate unique credential ID
      const credentialId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Create database record FIRST
      const credentialRecord = new this.credentialModel({
        credentialId,
        status: 'PENDING',
        name: payload.name,
        description: payload.description,
        subject: payload.subject,
        issuer: issuerId,
        metadataURI: payload.metadataURI,
        credentialType: payload.credentialType,
        validUntil: payload.validUntil || 0,
        evidenceHash: payload.evidenceHash,
        revocable: payload.revocable,
        createdAt: new Date()
      });
      
      await credentialRecord.save();
      
      // Then prepare blockchain transaction
      const iface = new ethers.Interface([
        'function issueCredential(address subject, string name, string description, string metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) returns (uint256)'
      ]);
      
      const data = iface.encodeFunctionData('issueCredential', [
        payload.subject,
        payload.name,
        payload.description,
        payload.metadataURI,
        payload.credentialType,
        payload.validUntil || 0,
        payload.evidenceHash,
        payload.revocable
      ]);
      
      // Queue transaction
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: this.configService.get<string>('RELAYER_ADDRESS') || payload.subject,
        target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        value: "0",
        data,
        operation: 0,
        description: `Issue credential "${payload.name}" for ${payload.subject}`,
        isAccountCreation: false
      });
      
      // Update credential record with transaction ID
      await this.credentialModel.updateOne(
        { _id: credentialRecord._id },
        { 
          transactionId: transactionResult.transactionId,
          transactionHash: transactionResult.transactionId
        }
      );
      
      return {
        transactionId: transactionResult.transactionId,
        status: "PENDING",
        subject: payload.subject,
        name: payload.name,
        description: payload.description,
        credentialId
      };
      
    } catch (error) {
      this.logger.error(`Failed to issue credential: ${error.message}`);
      throw error;
    }
  }

  async getCredentialsForWallet(walletAddress: string): Promise<any[]> {
    try {
      // First check if implementation is working
      const implWorks = await this.checkImplementation();
      if (!implWorks) {
        this.logger.warn('Implementation check failed, returning empty credentials');
        return [];
      }
      
      const iface = new ethers.Interface([
        'function getUserCredentials(address) external view returns (uint256[])'
      ]);
      
      const data = iface.encodeFunctionData('getUserCredentials', [walletAddress]);
      
      this.logger.log(`Calling getUserCredentials for address: ${walletAddress}`);
      
      try {
        const result = await this.provider.call({
          to: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
          data
        });
        
        const decoded = iface.decodeFunctionResult('getUserCredentials', result);
        const credentialIds = decoded[0];
        
        this.logger.log(`Found ${credentialIds.length} credentials for wallet ${walletAddress}`);
        
        if (credentialIds.length === 0) {
          return [];
        }
        
        // Fetch details for each credential
        const credentials = [];
        for (const id of credentialIds) {
          try {
            const credential = await this.getCredentialDetails(id.toString());
            credentials.push(credential);
          } catch (error) {
            this.logger.warn(`Error fetching credential ${id}: ${error.message}`);
          }
        }
        
        return credentials;
      } catch (error) {
        this.logger.warn(`Call to getUserCredentials failed: ${error.message}`);
        // Try alternative approach - direct call to get all issued credentials
        return await this.getAllCredentialsForAddress(walletAddress);
      }
    } catch (error) {
      this.logger.error(`Failed to get credentials for wallet: ${error.message}`);
      throw error;
    }
  }
  getCredentialDetails(arg0: any) {
    throw new Error('Method not implemented.');
  }

  // Add a fallback method to get credentials when getUserCredentials fails
  private async getAllCredentialsForAddress(address: string): Promise<any[]> {
    try {
      this.logger.log(`Attempting alternative credential lookup for ${address}`);
      
      // Check credential events instead of direct contract call
      const filter = this.credentialModule.filters.CredentialSubmitted(null, null, address);
      const events = await this.credentialModule.queryFilter(filter, -10000); // Last 10000 blocks
      
      this.logger.log(`Found ${events.length} credential events for ${address}`);
      
      if (events.length === 0) {
        return [];
      }
      
      // Extract credential IDs from events and get details
      const credentials = [];
      for (const event of events) {
        try {
          // Check if event is of type EventLog with args property
          if ('args' in event && event.args) {
            const id = event.args[0].toString();
            const credential = await this.getCredentialDetails(id);
            credentials.push(credential);
          } else {
            this.logger.warn(`Event doesn't have parsed args: ${JSON.stringify(event)}`);
          }
        } catch (error) {
          this.logger.warn(`Error fetching credential from event: ${error.message}`);
        }
      }
      
      return credentials;
    } catch (error) {
      this.logger.error(`Failed in alternative credential lookup: ${error.message}`);
      return [];
    }
  }

  async verifyCredential(credentialId: string, verifierId: string) {
    try {
      // Encode the function call
      const iface = new ethers.Interface([
        'function verifyCredential(uint256 tokenId, uint8 status, string notes) returns (bool)'
      ]);
      
      const data = iface.encodeFunctionData('verifyCredential', [
        credentialId,
        1, // VERIFIED status
        'Verified by PropellantBD administrator'
      ]);
      
      // Queue the transaction using the relayer
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: this.configService.get<string>('RELAYER_ADDRESS'),
        target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        value: "0",
        data,
        operation: 0,
        description: `Verify credential ID ${credentialId}`,
        isAccountCreation: false
      });
      
      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId
      };
    } catch (error) {
      this.logger.error(`Failed to verify credential: ${error.message}`);
      throw error;
    }
  }

  async revokeCredential(credentialId: string, revokerId: string) {
    try {
      // Encode the function call
      const iface = new ethers.Interface([
        'function revokeCredential(uint256 tokenId, string reason) returns (bool)'
      ]);
      
      const data = iface.encodeFunctionData('revokeCredential', [
        credentialId,
        'Revoked by PropellantBD administrator'
      ]);
      
      // Queue the transaction using the relayer
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: this.configService.get<string>('RELAYER_ADDRESS'),
        target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        value: "0",
        data,
        operation: 0,
        description: `Revoke credential ID ${credentialId}`,
        isAccountCreation: false
      });
      
      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId
      };
    } catch (error) {
      this.logger.error(`Failed to revoke credential: ${error.message}`);
      throw error;
    }
  }

  async ensureAccountExists(walletAddress: string): Promise<string> {
    try {
      // Use WalletService instead of creating our own contract instance
      return await this.walletService.deployAccountOnChain(walletAddress);
    } catch (error) {
      this.logger.error(`Failed to ensure account exists: ${error.message}`);
      throw new Error(`Could not create account for ${walletAddress}: ${error.message}`);
    }
  }

  private mapCredentialStatus(status: number): string {
    const statuses = ['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED'];
    return statuses[status] || 'UNKNOWN';
  }

  async checkImplementation(): Promise<boolean> {
    try {
      // Try to call a simple view function to verify the implementation works
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
      
      // Try both the input address and any associated account address
      const addresses = [inputAddress];
      
      // Also try to get the smart account address
      try {
        const accountAddress = await this.walletService.getOrCreateAccount(inputAddress);
        if (accountAddress !== inputAddress) {
          addresses.push(accountAddress);
        }
      } catch (error) {
        this.logger.warn(`Could not get account address for ${inputAddress}: ${error.message}`);
      }
      
      this.logger.log(`Searching for credentials with subjects: ${addresses.join(', ')}`);
      
      // Search database using both addresses
      const dbCredentials = await this.credentialModel.find({
        subject: { $in: addresses },
        status: 'PENDING'
      });
      
      this.logger.log(`Found ${dbCredentials.length} pending credentials in database`);
      
      if (dbCredentials.length === 0) {
        // Debug: check what subjects exist in the database
        const allSubjects = await this.credentialModel.distinct('subject');
        this.logger.log(`All subjects in database: ${allSubjects.join(', ')}`);
      }
      
      // Format response
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
