import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { UserOperationStruct } from '../interfaces/user-operation.interface';
import * as EntryPointABI from '../abis/EntryPoint.json';
import * as AccountFactoryABI from '../abis/AccountFactory.json';
import * as PaymasterABI from '../abis/Paymaster.json';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from '../schemas/transaction.schema';

@Injectable()
export class RelayerService implements OnModuleInit {
  private readonly logger = new Logger(RelayerService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private entryPoint: ethers.Contract;
  private accountFactory: ethers.Contract;
  private paymaster: ethers.Contract;
  private isProcessing = false;
  private pendingTransactions: Map<string, any> = new Map();
  getAccountAddress: any;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
  ) {}

  /**
 * Get transactions for a specific user wallet address
 * @param walletAddress The wallet address to fetch transactions for
 */
async getUserTransactions(walletAddress: string) {
  // Query transactions where the user address matches the provided wallet address
  const transactions = await this.transactionModel.find({
    userAddress: walletAddress
  }).sort({ createdAt: -1 }); // Most recent first
  
  return transactions;
}
  async onModuleInit() {
    await this.initializeProvider();
    this.logger.log('Relayer service initialized');
    
    // Start background processing of transactions
    this.startTransactionProcessing();
  }

  private async initializeProvider() {
    try {
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
      const privateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');
      
      if (!rpcUrl || !privateKey) {
        throw new Error('Missing blockchain configuration');
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      
      this.logger.log(`Relayer initialized with address: ${this.wallet.address}`);

      // Initialize contracts
      const entryPointAddress = this.configService.get<string>('ENTRY_POINT_ADDRESS');
      const accountFactoryAddress = this.configService.get<string>('ACCOUNT_FACTORY_ADDRESS');
      const paymasterAddress = this.configService.get<string>('PAYMASTER_ADDRESS');
      
      this.entryPoint = new ethers.Contract(
        entryPointAddress,
        EntryPointABI.abi,
        this.wallet,
      );
      
      this.accountFactory = new ethers.Contract(
        accountFactoryAddress,
        AccountFactoryABI.abi,
        this.wallet,
      );
      
      this.paymaster = new ethers.Contract(
        paymasterAddress,
        PaymasterABI.abi,
        this.wallet,
      );
    } catch (error) {
      this.logger.error(`Failed to initialize relayer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Queue a transaction to be submitted to the blockchain
   */
  async queueTransaction(payload: {
    userAddress: string;
    target: string;
    value: string;
    data: string;
    operation: number;
    description: string;
    isAccountCreation?: boolean; // Add this flag
  }) {
    try {
      const { userAddress, target, value, data, operation, description, isAccountCreation } = payload;
      
      // Skip account lookup for account creation transactions
      let accountAddress;
      if (isAccountCreation) {
        // For account creation, we use the target as the factory address
        accountAddress = target;
        this.logger.log(`Processing account creation for wallet: ${userAddress}`);
      } else {
        // For regular transactions, get the user's account address
        accountAddress = await this.accountFactory.getAccount(userAddress);
        
        if (accountAddress === ethers.ZeroAddress) {
          throw new Error(`No account found for user: ${userAddress}`);
        }
      }
      
      // Generate a unique transaction ID
      const transactionId = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'address', 'uint256', 'bytes', 'uint256', 'uint256'],
          [accountAddress, target, value, data, operation, Date.now()]
        )
      );
      
      // Store the transaction in database
      const transaction = new this.transactionModel({
        transactionId,
        userAddress,
        accountAddress,
        target,
        value,
        data,
        operation,
        status: 'PENDING',
        description,
        createdAt: new Date(),
        isAccountCreation: isAccountCreation || false,
      });
      
      await transaction.save();
      
      this.logger.log(`Transaction queued with ID: ${transactionId}`);
      
      // Emit event for real-time notifications
      this.eventEmitter.emit('transaction.queued', {
        transactionId,
        userAddress,
        status: 'PENDING',
      });
      
      return {
        transactionId,
        status: 'PENDING',
      };
    } catch (error) {
      this.logger.error(`Failed to queue transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction status by ID
   */
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
      error: transaction.error,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  /**
   * Start background processing of pending transactions
   */
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
    }, 15000); // Process every 15 seconds
  }

  /**
   * Process pending transactions
   */
  private async processPendingTransactions() {
    const pendingTransactions = await this.transactionModel.find({
      status: 'PENDING',
    }).sort({ createdAt: 1 }).limit(10);
    
    if (pendingTransactions.length === 0) return;
    
    this.logger.log(`Processing ${pendingTransactions.length} pending transactions`);
    
    for (const transaction of pendingTransactions) {
      try {
        await this.processTransaction(transaction);
      } catch (error) {
        this.logger.error(`Failed to process transaction ${transaction.transactionId}: ${error.message}`);
        
        // Update transaction status
        transaction.status = 'FAILED';
        transaction.error = error.message;
        transaction.updatedAt = new Date();
        await transaction.save();
        
        // Emit event
        this.eventEmitter.emit('transaction.failed', {
          transactionId: transaction.transactionId,
          userAddress: transaction.userAddress,
          error: error.message,
        });
      }
    }
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(transaction: TransactionDocument) {
    try {
      this.logger.log(`Processing transaction: ${transaction.transactionId}`);
      
      if (transaction.isAccountCreation) {
        try {
          // For account creation, fund the user's wallet first
          const userWallet = new ethers.Wallet(
            this.configService.get<string>('RELAYER_PRIVATE_KEY'),
            this.provider
          );
          
          // Transfer some ETH to the user's address for gas
          const tx = await userWallet.sendTransaction({
            to: transaction.userAddress,
            value: ethers.parseEther("0.01") // Send 0.01 ETH for gas
          });
          await tx.wait();
          
          // For account creation, use the factory's create method directly
          const accountFactoryWithSigner = this.accountFactory.connect(this.wallet);
          
          // Fix: Use type assertion to tell TypeScript about the method
          const createTx = await (accountFactoryWithSigner as any).createAccount(
            transaction.userAddress, // owner address 
            Math.floor(Date.now() / 1000) // salt
          );
          
          const receipt = await createTx.wait();
          
          // Update transaction status
          transaction.status = 'SUCCESS';
          transaction.transactionHash = receipt.hash;
          transaction.blockNumber = receipt.blockNumber;
          transaction.gasUsed = receipt.gasUsed?.toString();
          transaction.updatedAt = new Date();
          await transaction.save();
        } catch (error) {
          // Handle specific error for account creation
          this.logger.error(`Failed to create account: ${error.message}`);
          
          // Even if there's an error, we'll still update the transaction status
          transaction.status = 'FAILED';
          transaction.error = error.message;
          transaction.updatedAt = new Date();
          await transaction.save();
          
          throw error; // Propagate the error
        }
      } else {
        // For regular transactions, get account address first
        const accountAddress = await this.getAccountAddress(transaction.userAddress);
        
        // Try to get nonce - use alternative method if getNonce doesn't exist
        let nonce;
        try {
          nonce = await this.entryPoint.getNonce(accountAddress, 0);
        } catch (error) {
          // Fallback: use provider to get transaction count
          nonce = await this.provider.getTransactionCount(accountAddress);
        }
        
        // Create and submit UserOperation
        const userOp = await this.createUserOperation({
          sender: accountAddress,
          target: transaction.target,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
        });
        
        // Submit UserOperation
        const tx = await this.entryPoint.handleOps([userOp], this.wallet.address);
        const receipt = await tx.wait();
        
        // Update transaction status
        transaction.status = 'SUCCESS';
        transaction.transactionHash = receipt.hash;
        transaction.blockNumber = receipt.blockNumber;
        transaction.gasUsed = receipt.gasUsed?.toString();
        transaction.updatedAt = new Date();
        await transaction.save();
      }
      
      // Emit success event
      this.eventEmitter.emit('transaction.success', {
        transactionId: transaction.transactionId,
        userAddress: transaction.userAddress,
      });
      
    } catch (error) {
      this.logger.error(`Transaction processing failed: ${error.message}`);
      
      // Update transaction status if not already updated
      if (transaction.status === 'PENDING') {
        transaction.status = 'FAILED';
        transaction.error = error.message;
        transaction.updatedAt = new Date();
        await transaction.save();
      }
      
      // Emit failure event
      this.eventEmitter.emit('transaction.failed', {
        transactionId: transaction.transactionId,
        userAddress: transaction.userAddress,
        error: error.message,
      });
    }
  }

  /**
   * Create an ERC-4337 UserOperation
   */
  private async createUserOperation({
    sender,
    target,
    value,
    data,
    operation,
  }: {
    sender: string;
    target: string;
    value: string;
    data: string;
    operation: number;
  }) {
    // Get the current nonce for this account
    const nonce = await this.entryPoint.getNonce(sender, 0);
    
    // Prepare calldata
    const callData = this.encodeExecuteCallData(target, value, data);
    
    // Estimate gas
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(30000000000); // fallback value
    const gasLimit = await this.estimateGas(sender, callData);
    
    // Create user operation
    const userOp: UserOperationStruct = {
      sender,
      nonce: nonce.toString(),
      initCode: '0x',
      callData,
      callGasLimit: gasLimit.toString(),
      verificationGasLimit: '200000',
      preVerificationGas: '50000',
      maxFeePerGas: gasPrice.toString(),
      maxPriorityFeePerGas: (gasPrice / BigInt(2)).toString(),
      paymasterAndData: this.encodePaymasterData(),
      signature: '0x',
    };
    
    // Sign the user operation
    userOp.signature = await this.signUserOp(userOp);
    
    return userOp;
  }

  /**
   * Encode execute call data for the account
   */
  private encodeExecuteCallData(target: string, value: string, data: string) {
    const executeInterface = new ethers.Interface([
      'function execute(address target, uint256 value, bytes data) returns (bytes)',
    ]);
    
    return executeInterface.encodeFunctionData('execute', [target, value, data]);
  }

  /**
   * Encode paymaster data
   */
  private encodePaymasterData() {
    // In production, this would include proper paymaster validation data
    // For now, we're using a simplified version
    return ethers.concat([
      this.paymaster.target.toString(),
      '0x',
    ]);
  }

  /**
   * Estimate gas for user operation
   */
  private async estimateGas(sender: string, callData: string) {
    // This is a simplified estimation
    // In production, you'd use more accurate estimation techniques
    try {
      const gasEstimate = await this.provider.estimateGas({
        from: this.wallet.address,
        to: sender,
        data: callData,
      });
      
      // Add buffer for safety
      return gasEstimate * BigInt(120) / BigInt(100);
    } catch (error) {
      return BigInt(1000000); // Default fallback
    }
  }

  /**
   * Sign a user operation according to ERC-4337
   */
  private async signUserOp(userOp: UserOperationStruct) {
    const userOpHash = await this.entryPoint.getUserOpHash(userOp);
    const signature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
    return signature;
  }

  /**
   * Submit a user operation to the entrypoint
   */
  private async submitUserOperation(userOp: UserOperationStruct) {
    const tx = await this.entryPoint.handleOps([userOp], this.wallet.address);
    return tx.hash;
  }
}