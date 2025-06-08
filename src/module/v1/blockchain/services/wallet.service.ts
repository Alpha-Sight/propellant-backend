import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { Wallet, WalletDocument } from '../schemas/wallet.schema';
import * as AccountFactoryABI from '../abis/AccountFactory.json';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private provider: ethers.JsonRpcProvider;
  private accountFactory: ethers.Contract;

  constructor(
    private configService: ConfigService,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
  ) {
    this.initializeProvider();
  }

  private async initializeProvider() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    const accountFactoryAddress = this.configService.get<string>('ACCOUNT_FACTORY_ADDRESS');
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.accountFactory = new ethers.Contract(
      accountFactoryAddress,
      AccountFactoryABI.abi,
      this.provider,
    );
  }

  /**
   * Create a new wallet for a user
   */
  async createWallet(userAddress: string, salt: number = 0): Promise<WalletDocument> {
    try {
      // Check if wallet already exists
      const existingWallet = await this.walletModel.findOne({ userAddress });
      if (existingWallet) {
        return existingWallet;
      }

      // Predict account address
      const accountAddress = await this.predictAccountAddress(userAddress, salt);
      
      // Create wallet record
      const wallet = new this.walletModel({
        userAddress,
        walletAddress: userAddress, // For now, same as userAddress
        accountAddress,
        salt,
        status: 'CREATED',
        createdAt: new Date(),
      });

      await wallet.save();
      this.logger.log(`Wallet created for user ${userAddress}: ${accountAddress}`);
      
      return wallet;
      
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
      const predictedAddress = await this.accountFactory.getAccountAddress(ownerAddress, salt);
      this.logger.log(`Predicted account address: ${predictedAddress}`);
      return predictedAddress;
    } catch (error) {
      this.logger.error(`Failed to predict account address: ${error.message}`);
      throw error;
    }
  }
}