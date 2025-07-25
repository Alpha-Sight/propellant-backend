import { Injectable, Logger, OnModuleInit, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { UserOperationStruct } from '../interfaces/user-operation.interface';
import * as EntryPointABI from '../abis/EntryPoint.json';
import * as AccountFactoryABI from '../abis/AccountFactory.json';
import * as PaymasterABI from '../abis/Paymaster.json';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BlockchainTransaction, BlockchainTransactionDocument } from '../schemas/transaction.schema';
import { WalletService } from './wallet.service';
import { Credential, CredentialDocument } from '../schemas/credential.schema';
import { Wallet, WalletDocument } from '../schemas/wallet.schema';
import { TransactionStatusEnum, TransactionTypeEnum } from 'src/common/enums/transaction.enum';
import { UserDocument } from '../../user/schemas/user.schema';

@Injectable()
export class RelayerService implements OnModuleInit {
  private readonly logger = new Logger(RelayerService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private entryPoint: ethers.Contract;
  private credentialModule: ethers.Contract;
  private accountFactory: ethers.Contract;
  private userProfileModule: ethers.Contract;
  private roleModule: ethers.Contract;
  private storageModule: ethers.Contract;
  private credentialVerificationModule: ethers.Contract;
  private paymaster: ethers.Contract; // Add this property
  private isProcessing = false;
  private pendingTransactions: Map<string, any> = new Map();
  private ensSupportedChains = [1, 3, 4, 5, 11155111]; // mainnet, ropsten, rinkeby, goerli, sepolia

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,

    @InjectModel(BlockchainTransaction.name) private transactionModel: Model<BlockchainTransactionDocument>,
    @InjectModel(Credential.name) private credentialModel: Model<CredentialDocument>,
    @Inject(forwardRef(() => WalletService)) private readonly walletService: WalletService,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
  ) {}

  async onModuleInit() {
    await this.initializeProvider();
    this.startTransactionProcessing();
  }

  private async isEnsSupported(chainId: number): Promise<boolean> {
    return this.ensSupportedChains.includes(chainId);
  }

  private async resolveAddress(address: string): Promise<string> {
    try {
      const network = await this.provider.getNetwork();
      if (await this.isEnsSupported(Number(network.chainId))) {
        // ENS resolution only on supported networks
        return await this.provider.resolveName(address);
      }
      // Return address as-is for unsupported networks
      return address;
    } catch (error) {
      this.logger.warn('ENS resolution failed, using original address:', error.message);
      return address;
    }
  }

  private async initializeProvider() {
    try {
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
      const relayerPrivateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');
      const entryPointAddress = this.configService.get<string>('ENTRY_POINT_ADDRESS');
      const credentialModuleAddress = this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS');
      const accountFactoryAddress = this.configService.get<string>('ACCOUNT_FACTORY_ADDRESS');
      const paymasterAddress = this.configService.get<string>('PAYMASTER_ADDRESS');

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      // Force disable ENS to avoid resolution errors
      const originalGetNetwork = this.provider.getNetwork.bind(this.provider);
      this.provider.getNetwork = async () => {
        const network = await originalGetNetwork();
        Object.defineProperty(network, 'ensAddress', { value: null });
        return network;
      };

      this.wallet = new ethers.Wallet(relayerPrivateKey, this.provider);

      this.entryPoint = new ethers.Contract(entryPointAddress, EntryPointABI.abi, this.wallet);
      this.accountFactory = new ethers.Contract(accountFactoryAddress, AccountFactoryABI.abi, this.provider);
      
      if (paymasterAddress) {
        this.paymaster = new ethers.Contract(paymasterAddress, PaymasterABI.abi, this.wallet);
      }

      this.logger.log('Relayer service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize relayer service: ${error.message}`);
      throw error;
    }
  }

  async queueTransaction(payload: {
    userAddress: string;
    target: string;
    value: string;
    data: string;
    operation: number;
    description: string;
    isAccountCreation?: boolean;
  }) {
    try {
      this.logger.log(`Queuing transaction: ${JSON.stringify(payload)}`);
      // Validate userAddress
      if (!payload.userAddress || typeof payload.userAddress !== 'string' || payload.userAddress === ethers.ZeroAddress) {
        throw new Error('Invalid transaction payload: missing or invalid userAddress');
      }
      // Validate target
      if (!payload.target || typeof payload.target !== 'string' || payload.target === ethers.ZeroAddress) {
        throw new Error('Invalid transaction payload: missing or invalid target');
      }
      if (!payload.data) {
        throw new Error('Invalid transaction payload: missing data');
      }
      const {
        userAddress,
        target,
        value,
        data,
        operation,
        description,
        isAccountCreation,
      } = payload;
      let accountAddress: string;
      if (isAccountCreation) {
        accountAddress = target;
        this.logger.log(`Processing account creation for wallet: ${userAddress}`);
      } else {
        try {
          accountAddress = await this.accountFactory.getAccount(userAddress);
          if (!accountAddress || accountAddress === ethers.ZeroAddress || accountAddress === null) {
            this.logger.warn(`No valid smart account found for user: ${userAddress}, falling back to userAddress.`);
            accountAddress = userAddress;
          }
        } catch (error) {
          this.logger.warn(`Could not get smart account address, using user address: ${error.message}`);
          accountAddress = userAddress;
        }
      }
      const transactionId = ethers.keccak256(
        ethers.toUtf8Bytes(
          `${userAddress}-${target}-${Date.now()}-${Math.random()}`
        )
      );
      const transaction = new this.transactionModel({
        transactionId,
        userAddress,
        accountAddress,
        target,
        value,
        data,
        operation,
        status: TransactionStatusEnum.PENDING,
        type: TransactionTypeEnum.AccountCreation,
        description,
        createdAt: new Date(),
      });
      await transaction.save();
      this.logger.log(`Transaction queued with ID: ${transactionId}`);
      this.eventEmitter.emit('transaction.queued', {
        transactionId,
        userAddress,
        status: TransactionStatusEnum.PENDING,
      });
      return {
        transactionId: transactionId,
        status: 'PENDING'
      };
    } catch (error) {
      this.logger.error(`Failed to queue transaction: ${error.message}`);
      throw error;
    }
  }

  async getTransactionStatus(transactionId: string) {
    const transaction = await this.transactionModel.findOne({
      transactionId,
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    return {
      transactionId,
      status: transaction.status,
      blockNumber: transaction.blockNumber,
      transactionHash: transaction.transactionHash,
      error: transaction.lastError,
      createdAt: transaction.get('createdAt'),
      updatedAt: transaction.get('updatedAt'),
    };
  }

  private startTransactionProcessing() {
    setInterval(async () => {
      if (this.isProcessing) return;

      try {
        this.isProcessing = true;
        await this.processPendingTransactions();
      } catch (error) {
        this.logger.error(`Error processing transactions: ${error.message}`);
      } finally {
        this.isProcessing = false;
      }
    }, 15000);
  }

  private async processPendingTransactions() {
    try {
      const pendingTransactions = await this.transactionModel.find({
        status: TransactionStatusEnum.PENDING,
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).limit(5);
      
      if (pendingTransactions.length === 0) {
        return;
      }
      
      this.logger.log(`Processing ${pendingTransactions.length} pending transactions`);
      
      for (const transaction of pendingTransactions) {
        if (transaction.transactionHash) {
          try {
            const receipt = await this.provider.getTransactionReceipt(transaction.transactionHash);
            if (receipt) {
              await this.transactionModel.updateOne(
                { transactionId: transaction.transactionId },
                { status: TransactionStatusEnum.COMPLETED }
              );
              continue;
            }
          } catch (e) {
            // Ignore errors checking receipt, continue with processing
          }
        }
        
        try {
          await this.processTransaction(transaction._id.toString());
        } catch (error) {
          this.logger.error(`Failed to process transaction ${transaction._id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing transactions: ${error.message}`);
    }
  }

  private async processTransaction(transactionMongoId: string) {
    try {
      const transaction = await this.transactionModel.findById(transactionMongoId);
      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionMongoId}`);
      }
      this.logger.log(`Processing transaction ${transaction.transactionId}: ${transaction.description}`);

      const relayerPrivateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');
      if (!relayerPrivateKey) {
        throw new Error('RELAYER_PRIVATE_KEY not configured');
      }

      const provider = new ethers.JsonRpcProvider(this.configService.get<string>('BLOCKCHAIN_RPC_URL'));
      // Force disable ENS to avoid resolution errors
      const originalGetNetwork = provider.getNetwork.bind(provider);
      provider.getNetwork = async () => {
        const network = await originalGetNetwork();
        Object.defineProperty(network, 'ensAddress', { value: null });
        return network;
      };

      const relayerWallet = new ethers.Wallet(relayerPrivateKey, provider);

      const tx = await relayerWallet.sendTransaction({
        to: transaction.target,
        data: transaction.data,
        value: transaction.value || 0,
        gasLimit: 500000,
      });
      this.logger.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

      await this.transactionModel.updateOne(
        { _id: transactionMongoId },
        {
          status: 'COMPLETED',
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          processedAt: new Date(),
        }
      );

      let credentialStatus = 'ISSUED';
      
      if (transaction.description && transaction.description.includes('Verify credential')) {
        credentialStatus = 'VERIFIED';
      }

      await this.credentialModel.updateOne(
        { transactionId: transaction.transactionId },
        {
          status: credentialStatus,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
        }
      );

      this.logger.log(`Transaction ${transaction.transactionId} and associated credential updated to ${credentialStatus}.`);

    } catch (error) {
      // Improved error handling for transaction reverts and ENS issues
      this.logger.error(`Failed to process transaction with mongo ID ${transactionMongoId}: ${error.message}`);
      if (error.code === 'UNSUPPORTED_OPERATION' && error.operation === 'getEnsAddress') {
        this.logger.error('Network does not support ENS. Skipping ENS resolution.');
      }
      if (error.reason) {
        this.logger.error(`Transaction revert reason: ${error.reason}`);
      }
      // Optionally, update transaction status in DB with error info
      await this.transactionModel.updateOne(
        { _id: transactionMongoId },
        {
          status: 'FAILED',
          lastError: error.message,
          processedAt: new Date(),
        }
      );
    }
  }

  private encodePaymasterData() {
    if (this.paymaster) {
      return ethers.concat([this.paymaster.target.toString(), '0x']);
    }
    return '0x';
  }

  async getPaymasterData(): Promise<string> {
    return this.encodePaymasterData();
  }

  private encodeExecuteCallData(target: string, value: string, data: string) {
    const executeInterface = new ethers.Interface([
      'function execute(address target, uint256 value, bytes data) returns (bytes)',
    ]);

    return executeInterface.encodeFunctionData('execute', [
      target,
      value,
      data,
    ]);
  }

  private async estimateGas(sender: string, callData: string) {
    try {
      const gasEstimate = await this.provider.estimateGas({
        from: this.wallet.address,
        to: sender,
        data: callData,
      });

      return (gasEstimate * BigInt(120)) / BigInt(100);
    } catch (error) {
      return BigInt(1000000);
    }
  }

  async getUserTransactions(walletAddress: string) {
    const transactions = await this.transactionModel
      .find({
        userAddress: walletAddress,
      })
      .sort({ createdAt: -1 });

    return transactions;
  }
}
