import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { Wallet, WalletDocument } from '../schemas/wallet.schema';
import * as AccountFactoryABI from '../abis/AccountFactory.json';
import { createHash } from 'crypto';
import { RelayerService } from './relayer.service';
import { Credential, CredentialDocument } from '../schemas/credential.schema';

@Injectable()
export class WalletService {
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
  private readonly logger = new Logger(WalletService.name);
  private provider: ethers.JsonRpcProvider;
  private accountFactory: ethers.Contract;
  private credentialContract: ethers.Contract;

  constructor(
    private configService: ConfigService,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Credential.name) private credentialModel: Model<CredentialDocument>,
    @Inject(forwardRef(() => RelayerService)) private relayerService: RelayerService,
  ) {
    this.initializeProvider();
    this.initializeContract();
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
    
    // Add validation
    if (!contractAddress) {
      throw new Error('CREDENTIAL_VERIFICATION_MODULE_ADDRESS not configured');
    }
    if (!rpcUrl) {
      throw new Error('BLOCKCHAIN_RPC_URL not configured');
    }
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Load the contract ABI
    const contractABI = [
      'function issueCredential(address subject, string name, string description, string metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) returns (uint256)',
      'function verifyCredential(uint256 credentialId)',
      'function getCredential(uint256 credentialId) view returns (tuple)',
      'function getUserCredentials(address user) view returns (uint256[])',
      'function getPendingCredentials(address user) view returns (uint256[])',
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
  async createWallet(userId: string, email: string): Promise<WalletDocument> {
    try {
      // Check if wallet already exists for this user
      const existingWallet = await this.walletModel.findOne({ userId });
      if (existingWallet) {
        return existingWallet;
      }

      // Try multiple salts if needed to avoid duplicate account addresses
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          // Generate a unique hexadecimal salt for the wallet address
          const walletSalt = ethers.hexlify(ethers.randomBytes(16));
          
          // Generate deterministic wallet address
          const userAddress = this.generateDeterministicAddress(email, walletSalt);
          
          // Use a numeric salt based on attempt number for account creation
          // This ensures different account addresses for different users
          const accountSalt = attempt;
          
          // Predict account address
          const accountAddress = await this.predictAccountAddress(userAddress, accountSalt);
          
          // Check if this account address is already in use
          const existingAccount = await this.walletModel.findOne({ accountAddress });
          if (existingAccount) {
            this.logger.warn(`Account address ${accountAddress} already exists, trying next salt`);
            continue;
          }
          
          // Create wallet record - NO PRIVATE KEYS!
          const wallet = new this.walletModel({
            userId,
            userAddress,
            walletAddress: userAddress,
            accountAddress,
            salt: accountSalt,  // Store the numeric salt, not the hex one
            status: 'CREATED',
            createdAt: new Date(),
          });

          await wallet.save();
          this.logger.log(`Wallet created for user ${userId}: ${accountAddress} (attempt: ${attempt})`);
          
          return wallet;
        } catch (error) {
          // Only retry on duplicate key errors
          if (error.code !== 11000) {
            throw error;
          }
          this.logger.warn(`Attempt ${attempt} failed with duplicate key, trying again`);
        }
      }
      
      throw new Error('Failed to create wallet after multiple attempts');
    } catch (error) {
      this.logger.error(`Failed to create wallet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get or create an account address for a given owner
   */
  async getOrCreateAccount(ownerAddress: string, salt: number = 0): Promise<string> {
    try {
      // Validate address format first
      if (!ethers.isAddress(ownerAddress)) {
        throw new Error(`Invalid Ethereum address format: ${ownerAddress}`);
      }

      // First check if account already exists
      const existingAccount = await this.accountFactory.getAccount(ownerAddress);
      
      if (existingAccount !== ethers.ZeroAddress) {
        return existingAccount;
      }

      // Predict the account address without creating it
      const predictedAddress = await this.predictAccountAddress(ownerAddress, salt);
      this.logger.log(`Predicted account address: ${predictedAddress}`);
      
      return predictedAddress;
    } catch (error) {
      this.logger.error(`Failed to get or create account: ${error.message}`);
      throw error;
    }
  }

  /**
   * Predict account address without creating it
   */
  async predictAccountAddress(ownerAddress: string, salt: number = 0): Promise<string> {
    try {
      // Validate address format first
      if (!ethers.isAddress(ownerAddress)) {
        throw new Error(`Invalid Ethereum address format: ${ownerAddress}`);
      }

      // Extra safety: ensure address is properly formatted with checksum
      const checksummedAddress = ethers.getAddress(ownerAddress);
      
      const predictedAddress = await this.accountFactory.getAccountAddress(checksummedAddress, salt);
      this.logger.log(`Predicted account address: ${predictedAddress} (salt: ${salt})`);
      return predictedAddress;
    } catch (error) {
      this.logger.error(`Failed to predict account address: ${error.message}`);
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
}