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
      this.logger.log(`Credential saved to database: ${credentialId}`);
      
      // Prepare blockchain transaction
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
      
      this.logger.log(`Prepared transaction data for credential: ${credentialId}`);
      
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
      
      this.logger.log(`Transaction queued: ${transactionResult.transactionId}`);
      
      // Update credential record with transaction ID
      await this.credentialModel.updateOne(
        { _id: credentialRecord._id },
        { 
          transactionId: transactionResult.transactionId
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
      this.logger.log(`Getting all credentials for wallet: ${walletAddress}`);
      
      // 1. Get database credentials (including pending ones)
      const addresses = [walletAddress];
      
      // Also try to get the smart account address
      try {
        const accountAddress = await this.walletService.getOrCreateAccount(walletAddress);
        if (accountAddress !== walletAddress) {
          addresses.push(accountAddress);
        }
      } catch (error) {
        this.logger.warn(`Could not get account address for ${walletAddress}: ${error.message}`);
      }
      
      // Get all credentials from database (all statuses)
      const dbCredentials = await this.credentialModel.find({
        subject: { $in: addresses }
      });
      
      this.logger.log(`Found ${dbCredentials.length} credentials in database`);
      
      // 2. Get blockchain credentials (only issued/verified ones)
      let blockchainCredentials = [];
      
      // Check if implementation is working
      const implWorks = await this.checkImplementation();
      if (implWorks) {
        try {
          const iface = new ethers.Interface([
            'function getUserCredentials(address) external view returns (uint256[])'
          ]);
          
          const data = iface.encodeFunctionData('getUserCredentials', [walletAddress]);
          
          const result = await this.provider.call({
            to: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
            data
          });
          
          const decoded = iface.decodeFunctionResult('getUserCredentials', result);
          const credentialIds = decoded[0];
          
          this.logger.log(`Found ${credentialIds.length} credentials on blockchain`);
          
          // Fetch details for each blockchain credential
          for (const id of credentialIds) {
            try {
              const credential = await this.getCredentialDetails(id.toString());
              blockchainCredentials.push({
                ...credential,
                source: 'blockchain'
              });
            } catch (error) {
              this.logger.warn(`Error fetching blockchain credential ${id}: ${error.message}`);
            }
          }
        } catch (error) {
          this.logger.warn(`Blockchain credential lookup failed: ${error.message}`);
        }
      }
      
      // 3. Combine and deduplicate credentials
      const combinedCredentials = [];
      const seenCredentials = new Set();
      
      // Add database credentials
      for (const dbCred of dbCredentials) {
        const credentialData = {
          id: dbCred.credentialId,
          name: dbCred.name,
          description: dbCred.description,
          status: dbCred.status,
          subject: dbCred.subject,
          issuer: dbCred.issuer,
          credentialType: dbCred.credentialType,
          createdAt: dbCred.createdAt,
          transactionId: dbCred.transactionId,
          transactionHash: dbCred.transactionHash,
          source: 'database'
        };
        
        combinedCredentials.push(credentialData);
        seenCredentials.add(dbCred.credentialId);
      }
      
      // Add blockchain credentials that aren't already in database
      for (const blockchainCred of blockchainCredentials) {
        if (!seenCredentials.has(blockchainCred.id)) {
          combinedCredentials.push(blockchainCred);
        }
      }
      
      this.logger.log(`Returning ${combinedCredentials.length} total credentials`);
      
      return combinedCredentials;
      
    } catch (error) {
      this.logger.error(`Failed to get credentials for wallet: ${error.message}`);
      throw error;
    }
  }
  async getCredentialDetails(credentialId: string): Promise<any> {
    try {
      const iface = new ethers.Interface([
        'function getCredential(uint256) external view returns (tuple(address issuer, address subject, string name, string description, string metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable, uint8 status))'
      ]);
      
      const data = iface.encodeFunctionData('getCredential', [credentialId]);
      
      const result = await this.provider.call({
        to: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        data
      });
      
      const decoded = iface.decodeFunctionResult('getCredential', result);
      const credentialData = decoded[0];
      
      return {
        id: credentialId,
        issuer: credentialData.issuer,
        subject: credentialData.subject,
        name: credentialData.name,
        description: credentialData.description,
        metadataURI: credentialData.metadataURI,
        credentialType: credentialData.credentialType,
        validUntil: credentialData.validUntil.toString(),
        evidenceHash: credentialData.evidenceHash,
        revocable: credentialData.revocable,
        status: this.mapCredentialStatus(credentialData.status)
      };
    } catch (error) {
      this.logger.error(`Failed to get credential details for ID ${credentialId}: ${error.message}`);
      throw error;
    }
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

  async verifyCredential(credentialId: string, verifierAddress: string) {
    try {
      this.logger.log(`Verifying credential: ${credentialId} by verifier: ${verifierAddress}`);

      if (!ethers.isAddress(verifierAddress)) {
        throw new Error(`Invalid verifier address format: ${verifierAddress}`);
      }
      
      // Find the credential in database first
      const dbCredential = await this.credentialModel.findOne({
        credentialId: credentialId
      });
      
      if (!dbCredential) {
        throw new Error(`Credential not found: ${credentialId}`);
      }
      
      // Check if credential is in a valid state for verification
      // FIX: Allow verification if status is ISSUED or if it's a retry on a VERIFYING status.
      if (dbCredential.status !== 'ISSUED' && dbCredential.status !== 'VERIFYING') {
        throw new Error(`Credential must be in ISSUED or VERIFYING state for verification. Current status: ${dbCredential.status}`);
      }
      
      // Get the blockchain credential ID from the transaction receipt
      let blockchainCredentialId: number;
      
      if (dbCredential.transactionHash) {
        const receipt = await this.provider.getTransactionReceipt(dbCredential.transactionHash);
        
        if (receipt && receipt.logs.length > 0) {
          const iface = new ethers.Interface([
            'event CredentialSubmitted(uint256 indexed credentialId, address indexed issuer, address indexed subject)'
          ]);
          
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog({
                topics: Array.from(log.topics),
                data: log.data
              });
              if (parsed && parsed.name === 'CredentialSubmitted') {
                blockchainCredentialId = Number(parsed.args[0]);
                break;
              }
            } catch (error) {
              // Continue if this log doesn't match our event
            }
          }
        }
      }
      
      if (!blockchainCredentialId) {
        throw new Error('Could not find blockchain credential ID');
      }
      
      this.logger.log(`Found blockchain credential ID: ${blockchainCredentialId}`);
      
      // **FIXED**: Encode the function call with the correct signature and parameters
      const iface = new ethers.Interface([
        'function verifyCredential(uint256 credentialId, uint8 status, string memory notes)'
      ]);

      const verificationStatus = 1; // 1 = VERIFIED from your contract's enum
      const verificationNotes = `Verified by ${verifierAddress} via PropellantBD`;
      
      const data = iface.encodeFunctionData('verifyCredential', [
        blockchainCredentialId,
        verificationStatus,
        verificationNotes
      ]);
      
      // Queue verification transaction
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: verifierAddress, // **FIXED**: Use the verifier's wallet address
        target: this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS'),
        value: "0",
        data,
        operation: 0,
        description: `Verify credential ${credentialId} (blockchain ID: ${blockchainCredentialId})`,
        isAccountCreation: false
      });
      
      // Update database record
      await this.credentialModel.updateOne(
        { credentialId: credentialId },
        {
          status: 'VERIFYING',
          verificationTransactionId: transactionResult.transactionId
        }
      );
      
      return {
        transactionId: transactionResult.transactionId,
        status: 'PENDING',
        credentialId: credentialId,
        blockchainCredentialId: blockchainCredentialId
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
