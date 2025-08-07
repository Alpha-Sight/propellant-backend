import { Injectable, Logger, forwardRef, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { Wallet, WalletDocument } from '../schemas/wallet.schema';
import * as AccountFactoryABI from '../abis/AccountFactory.json';
import { createHash } from 'crypto';
import { RelayerService } from './relayer.service';
import { Credential, CredentialDocument } from '../schemas/credential.schema';
import { BaseHelper } from '../../../../common/utils/helper/helper.util';

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);
  private provider: ethers.JsonRpcProvider;
  private accountFactory: ethers.Contract;
  private credentialContract: ethers.Contract;

  constructor(
    private configService: ConfigService,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Credential.name) private credentialModel: Model<CredentialDocument>,
    @Inject(forwardRef(() => RelayerService)) private relayerService: RelayerService,
  ) {}

  async onModuleInit() {
    try {
      await this.initializeProvider();
      await this.initializeContract();
    } catch (error) {
      this.logger.error(`Failed to initialize WalletService: ${error.message}`);
    }
  }

  private async initializeProvider() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    const accountFactoryAddress = this.configService.get<string>('ACCOUNT_FACTORY_ADDRESS');
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Force disable ENS to avoid resolution errors
    const originalGetNetwork = this.provider.getNetwork.bind(this.provider);
    this.provider.getNetwork = async () => {
      const network = await originalGetNetwork();
      Object.defineProperty(network, 'ensAddress', { value: null });
      return network;
    };
    
    this.accountFactory = new ethers.Contract(
      accountFactoryAddress,
      AccountFactoryABI.abi,
      this.provider,
    );
  }

  private async initializeContract() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    const contractAddress = this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS');
    
    if (!contractAddress) {
      throw new Error('CREDENTIAL_VERIFICATION_MODULE_ADDRESS not configured');
    }
    if (!rpcUrl) {
      throw new Error('BLOCKCHAIN_RPC_URL not configured');
    }
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Fixed ABI with proper function signatures
    const contractABI = [
      'function issueCredential(address subject, string memory name, string memory description, string memory metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) external returns (uint256)',
      'function verifyCredential(uint256 credentialId) external returns (bool)',
      'function getCredential(uint256 credentialId) external view returns (tuple(address issuer, address subject, string name, string description, uint8 status))',
      'function getUserCredentials(address user) external view returns (uint256[])',
      'function getPendingCredentials(address user) external view returns (uint256[])',
      'event CredentialSubmitted(uint256 indexed credentialId, address indexed issuer, address indexed subject)',
      'event CredentialVerified(uint256 indexed credentialId, address indexed verifier)'
    ];
    
    this.credentialContract = new ethers.Contract(
      contractAddress,
      contractABI,
      this.provider
    );
    
    this.logger.log(`Credential contract initialized at ${contractAddress}`);
  }

  // Add this method that CredentialService expects
  getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      throw new Error('Provider not initialized. Call initializeProvider first.');
    }
    return this.provider;
  }

  // Add this method if needed by CredentialService
  async getAccountAddress(walletAddress: string): Promise<string> {
    try {
      // Implementation to get account address from wallet address
      const salt = Math.floor(Date.now() / 1000); // or use a stored salt
      return await this.accountFactory.getAccountAddress(walletAddress, salt);
    } catch (error) {
      this.logger.error(`Failed to get account address for ${walletAddress}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate deterministic address from user info (email + salt)
   */
  private generateDeterministicAddress(email: string, salt: string): string {
    // Create a deterministic seed from email and salt
    const seed = createHash('sha256')
      .update(`${email}:${salt}:${this.configService.get('APP_SECRET')}`)
      .digest('hex');
    
    // Create a wallet from the seed
    const wallet = ethers.HDNodeWallet.fromSeed(Buffer.from(seed, 'hex'));
    
    return wallet.address;
  }

  /**
   * Create a new wallet for a user
   * @param userId The user's ID
   * @param email The user's email for deterministic generation
   */
  async createWallet(userId?: string, email?: string): Promise<WalletDocument | any> {
    try {
      const wallet = BaseHelper.generateWallet();
      this.logger.log(`Generated new wallet address: ${wallet.walletAddress}`);

      const salt = Math.floor(Date.now() / 1000);
      const data = this.encodeCreateAccountData(wallet.walletAddress, salt);

      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: wallet.walletAddress,
        target: this.configService.get<string>('ACCOUNT_FACTORY_ADDRESS'),
        value: '0',
        data,
        operation: 0,
        description: `Create account for wallet ${wallet.walletAddress}`,
        isAccountCreation: true,
      });

      let accountAddress;
      try {
        accountAddress = await this.accountFactory.getAccountAddress(
          wallet.walletAddress,
          salt,
        );
      } catch (error) {
        this.logger.error(`Failed to predict account address: ${error.message}`);
        accountAddress = '0x0000000000000000000000000000000000000000';
      }

      if (userId) {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const walletDoc = new this.walletModel({
              userId,
              userAddress: wallet.walletAddress,
              walletAddress: wallet.walletAddress,
              accountAddress,
              salt,
              status: 'CREATED',
              createdAt: new Date(),
            });

            await walletDoc.save();
            this.logger.log(`Wallet created for user ${userId}: ${accountAddress} (attempt: ${attempt})`);
            
            return walletDoc;
          } catch (error) {
            if (error.code !== 11000) {
              throw error;
            }
            this.logger.warn(`Attempt ${attempt} failed with duplicate key, trying again`);
          }
        }
        
        throw new Error('Failed to create wallet after multiple attempts');
      }

      return {
        walletAddress: wallet.walletAddress,
        privateKey: wallet.privateKey,
        accountAddress,
        transactionId: transactionResult.transactionId,
      };
    } catch (error) {
      this.logger.error(`Failed to create wallet: ${error.message}`);
      throw error;
    }
  }

  private encodeCreateAccountData(walletAddress: string, salt: number): string {
    try {
      const iface = new ethers.Interface([
        'function createAccount(address owner, uint256 salt) returns (address)',
      ]);

      return iface.encodeFunctionData('createAccount', [walletAddress, salt]);
    } catch (error) {
      this.logger.error(`Failed to encode account data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deploy the account on-chain for a given wallet
   */
  async deployAccountOnChain(walletAddress: string): Promise<string> {
    try {

      // Get the wallet record from database
      const wallet = await this.walletModel.findOne({ walletAddress });
      if (!wallet) {
        throw new Error(`No wallet record found for address: ${walletAddress}`);
      }

      // Check if the account already exists on-chain
      const existingAccount = await this.accountFactory.getAccount(walletAddress);
      if (existingAccount !== ethers.ZeroAddress) {
        this.logger.log(`Account already exists on-chain for ${walletAddress}: ${existingAccount}`);
        return existingAccount;
      }

      // We need to deploy the account using a signer
      const privateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');
      const signer = new ethers.Wallet(privateKey, this.provider);
      
      const accountFactoryWithSigner = this.accountFactory.connect(signer);

      // Deploy the account with the saved salt
      this.logger.log(`Deploying account for ${walletAddress} with salt ${wallet.salt}`);
      const tx = await accountFactoryWithSigner["createAccount"](walletAddress, wallet.salt);
      const receipt = await tx.wait();
      
      // Get the deployed account address directly from the contract
      const deployedAccountAddress = await this.accountFactory.getAccount(walletAddress);
      
      if (deployedAccountAddress === ethers.ZeroAddress) {
        throw new Error("Account creation transaction succeeded but account not found");
      }
      
      this.logger.log(`Account deployed for ${walletAddress} at ${deployedAccountAddress}`);
      
      // Update the wallet record with deployment information
      await this.walletModel.updateOne(
        { _id: wallet._id },
        { 
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        }
      );
      
      return deployedAccountAddress;

    } catch (error) {
      this.logger.error(`Failed to deploy account: ${error.message}`);
      throw error;
    }
  }

  async getWalletByUserId(userId: string): Promise<WalletDocument | null> {
    return this.walletModel.findOne({ userId }).exec();
  }

  async getAllWallets(): Promise<WalletDocument[]> {
    return this.walletModel.find().exec();
  }
}
