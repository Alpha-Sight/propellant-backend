import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BaseHelper } from '../../../../common/utils/helper/helper.util';
import { RelayerService } from './relayer.service';
import * as AccountFactoryABI from '../abis/AccountFactory.json';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private provider: ethers.JsonRpcProvider;
  private accountFactory: ethers.Contract;

  constructor(
    private configService: ConfigService,
    private relayerService: RelayerService,
  ) {
    this.initializeProvider();
  }

  private async initializeProvider() {
    try {
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');

      if (!rpcUrl) {
        throw new Error('Missing blockchain configuration');
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize contract
      const accountFactoryAddress = this.configService.get<string>(
        'ACCOUNT_FACTORY_ADDRESS',
      );

      this.logger.log(
        `Initializing with Account Factory: ${accountFactoryAddress}`,
      );

      // Use simple provider for read-only operations
      this.accountFactory = new ethers.Contract(
        accountFactoryAddress,
        AccountFactoryABI.abi,
        this.provider,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize wallet service: ${error.message}`,
      );
    }
  }

  async createWallet() {
    try {
      // Generate a new wallet
      const wallet = BaseHelper.generateWallet();
      this.logger.log(`Generated new wallet address: ${wallet.walletAddress}`);

      // Queue a transaction to create an account for this wallet
      const salt = Math.floor(Date.now() / 1000); // Use timestamp as salt

      const data = this.encodeCreateAccountData(wallet.walletAddress, salt);

      this.logger.log(
        `Creating wallet with salt ${salt} for address ${wallet.walletAddress}`,
      );

      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: wallet.walletAddress,
        target: this.configService.get<string>('ACCOUNT_FACTORY_ADDRESS'),
        value: '0',
        data,
        operation: 0,
        description: `Create account for wallet ${wallet.walletAddress}`,
        isAccountCreation: true,
      });

      // Calculate the expected account address
      let accountAddress;
      try {
        accountAddress = await this.accountFactory.getAccountAddress(
          wallet.walletAddress,
          salt,
        );
        this.logger.log(`Predicted account address: ${accountAddress}`);
      } catch (error) {
        this.logger.error(
          `Failed to predict account address: ${error.message}`,
        );
        accountAddress = '0x0000000000000000000000000000000000000000';
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
}
