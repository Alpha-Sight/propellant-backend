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
import { Transaction, TransactionDocument } from '../schemas/transaction.schema';
import { WalletService } from './wallet.service';

// Define transaction status enum
enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

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

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @Inject(forwardRef(() => WalletService)) private readonly walletService: WalletService,
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
    try {
      // Check for pending transactions
      const pendingTransactions = await this.transactionModel.find({
        status: TransactionStatus.PENDING,
        createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Only process transactions less than 24 hours old
      }).limit(5);
      
      if (pendingTransactions.length === 0) {
        return;
      }
      
      this.logger.log(`Processing ${pendingTransactions.length} pending transactions`);
      
      for (const transaction of pendingTransactions) {
        // Skip if this transaction hash already exists on-chain
        if (transaction.transactionHash) {
          try {
            const receipt = await this.provider.getTransactionReceipt(transaction.transactionHash);
            if (receipt) {
              // Transaction already confirmed, update status without reprocessing
              await this.transactionModel.updateOne(
                { transactionId: transaction.transactionId },
                { status: TransactionStatus.CONFIRMED }
              );
              continue;
            }
          } catch (e) {
            // Ignore errors checking receipt, continue with processing
          }
        }
        
        try {
          await this.processTransaction(transaction);
        } catch (error) {
          this.logger.error(`Failed to process transaction ${transaction.transactionId}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing transactions: ${error.message}`);
    }
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(transaction: TransactionDocument): Promise<void> {
    try {
      this.logger.log(`Processing transaction: ${transaction.transactionId}`);
      
      // Ensure we have a valid account address
      if (!transaction.accountAddress) {
        throw new Error('Transaction missing account address');
      }
      
      // Create user operation
      const userOp = await this.createUserOperation({
        sender: transaction.accountAddress,
        target: transaction.target,
        value: transaction.value,
        data: transaction.data,
        operation: transaction.operation,
      });
      
      this.logger.log(`Created user operation for ${transaction.transactionId}`);
      
      // Submit the user operation
      const receipt = await this.submitUserOperation(userOp);
      
      // Update transaction with just the hash string, not the entire receipt object
      await this.transactionModel.updateOne(
        { transactionId: transaction.transactionId },
        {
          status: TransactionStatus.CONFIRMED,
          blockNumber: receipt.blockNumber.toString(), // Convert BigInt to string if needed
          transactionHash: receipt.hash, // Just the hash string, not the whole receipt
        },
      );
      
      // Emit transaction confirmation event
      this.eventEmitter.emit('transaction.confirmed', { 
        transactionId: transaction.transactionId, 
        blockNumber: receipt.blockNumber, 
        transactionHash: receipt.hash 
      });
      
      return receipt;
    } catch (error) {
      // Add safeguard: Mark transaction as FAILED so it won't be processed again
      await this.transactionModel.updateOne(
        { transactionId: transaction.transactionId },
        {
          status: TransactionStatus.FAILED,
          error: {
            message: error.message || 'Unknown error',
            type: error.code || 'UNKNOWN',
            details: JSON.stringify(error, Object.getOwnPropertyNames(error))
          },
        },
      );
      
      this.logger.error(`Transaction processing failed for ${transaction.transactionId}: ${error.message}`);
      throw error;
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
    try {
      console.log("Starting createUserOperation");
      console.log("Arguments:", { sender, target, value, data: data.slice(0, 10) + "...", operation });
      
      // Log each step
      console.log("Getting nonce");
      const nonce = await this.entryPoint.getNonce(sender, 0);
      console.log("Nonce received:", nonce);
      
      console.log("Encoding calldata");
      const callData = this.encodeExecuteCallData(target, value, data);
      console.log("Calldata encoded");
      
      // Estimate gas
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(30000000000); // fallback value
      const gasLimit = await this.estimateGas(sender, callData);
      
      // Create user operation
      const userOp: UserOperationStruct = {
        sender,
        nonce: nonce.toString(),
        initCode: '0x', // Empty for existing accounts
        callData,
        callGasLimit: gasLimit.toString(),
        verificationGasLimit: '150000',
        preVerificationGas: '21000',
        maxFeePerGas: gasPrice.toString(),
        maxPriorityFeePerGas: gasPrice.toString(),
        paymasterAndData: await this.getPaymasterData(),
        signature: '0x', // Will be filled later
      };
      
      return userOp;
    } catch (error) {
      console.error("Error details:", error);
      this.logger.error(`Failed to create user operation: ${error.message}`);
      throw error;
    }
  }
 async getPaymasterData(): Promise<string> {
  return this.encodePaymasterData();
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
   * Submit a user operation to the entrypoint
   */
  private async submitUserOperation(userOp: UserOperationStruct) {
    try {
      // Log the full user operation object
      console.log("Submitting user operation:", {
        sender: userOp.sender,
        nonce: userOp.nonce.toString(),
        callDataLength: userOp.callData.length,
        callGasLimit: userOp.callGasLimit.toString(),
        verificationGasLimit: userOp.verificationGasLimit.toString(),
        preVerificationGas: userOp.preVerificationGas.toString(),
        maxFeePerGas: userOp.maxFeePerGas.toString(),
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString(),
        paymasterAndDataLength: userOp.paymasterAndData.length,
        signatureLength: userOp.signature.length
      });
      
      // Check if account has a deposit in EntryPoint
      console.log("Checking EntryPoint deposit for account:", userOp.sender);
      const depositInfo = await this.entryPoint.getDepositInfo(userOp.sender);
      console.log("Deposit info:", {
        amount: depositInfo.amount.toString(),
        staked: depositInfo.staked
      });
      
      // If account doesn't have a deposit, deposit funds from the relayer
      if (depositInfo.amount < ethers.parseEther("0.001")) {
        console.log("Account has insufficient deposit, depositing funds...");
        try {
          const depositTx = await this.entryPoint.depositTo(userOp.sender, {
            value: ethers.parseEther("0.01") 
          });
          const depositReceipt = await depositTx.wait();
          console.log("Deposit successful:", depositReceipt.hash);
        } catch (depositError) {
          console.error("Failed to deposit to EntryPoint:", depositError);
        }
      }

      // Check if the paymaster has a deposit in EntryPoint
      if (this.paymaster) {
        console.log("Checking EntryPoint deposit for paymaster:", this.paymaster.target);
        const paymasterDeposit = await this.entryPoint.getDepositInfo(this.paymaster.target);
        console.log("Paymaster deposit info:", {
          amount: paymasterDeposit.amount.toString(),
          staked: paymasterDeposit.staked
        });

        // If paymaster doesn't have a deposit, warn about it
        if (paymasterDeposit.amount < ethers.parseEther("0.001")) {
          console.warn("WARNING: Paymaster has insufficient funds in EntryPoint");
        }
      }

      // Log that we're signing the operation
      console.log("Signing user operation...");
      const signature = await this.signUserOp(userOp);
      userOp.signature = signature;
      console.log("Operation signed, signature length:", userOp.signature.length);

      // Check if the EntryPoint contract has the handleOps method
      console.log("EntryPoint contract methods:", 
        Object.keys(this.entryPoint.interface.fragments)
          .filter(key => typeof key === 'string' && !key.includes('('))
          .join(", ")
      );
      
      console.log("EntryPoint address:", this.entryPoint.target);
      console.log("Beneficiary address:", this.wallet.address);
      
      // Try to estimate gas for the operation first
      try {
        console.log("Estimating gas for handleOps...");
        const gasEstimate = await this.entryPoint.handleOps.estimateGas(
          [userOp],
          this.wallet.address
        );
        console.log("Gas estimation successful:", gasEstimate.toString());
      } catch (estimateError) {
        console.error("Gas estimation failed with error:", estimateError);
        
        // Try to get more specific error details
        console.log("Trying to decode error...");
        try {
          const errorData = estimateError.data;
          if (errorData) {
            console.log("Error data:", errorData);
          }
        } catch (decodeError) {
          console.log("Could not decode error data");
        }
      }
      
      // Submit the user operation with extra gas
      console.log("Submitting handleOps transaction...");
      const tx = await this.entryPoint.handleOps(
        [userOp],
        this.wallet.address,
        { gasLimit: 1000000 } // Use a higher gas limit for safety
      );
      
      console.log("Transaction submitted:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt.blockNumber);
      
      return receipt;
    } catch (error) {
      console.log("Full submit error:", error);
      if (error.reason) {
        console.error("Error reason:", error.reason);
      }
      if (error.code) {
        console.error("Error code:", error.code);
      }
      if (error.data) {
        console.error("Error data:", error.data);
      }
      if (error.transaction) {
        console.error("Failed transaction to:", error.transaction.to);
        console.error("Failed transaction data (first 100 chars):", 
          error.transaction.data.substring(0, 100) + "...");
      }
      throw error;
    }
  }

  /**
   * Sign a user operation according to ERC-4337
   */
  private async signUserOp(userOp: UserOperationStruct) {
    try {
      console.log("Preparing to sign user operation");
      
      // Get the chain ID
      const network = await this.provider.getNetwork();
      const chainId = network.chainId;
      console.log("Chain ID:", chainId.toString());
      
      // Get the EntryPoint address
      const entryPointAddress = this.entryPoint.target;
      console.log("EntryPoint address:", entryPointAddress);
      
      // Calculate the user op hash locally instead of calling the contract
      console.log("Calculating user op hash...");
      const userOpHash = this.calculateUserOpHash(userOp);
      console.log("User op hash:", userOpHash);
      
      // Sign the hash
      console.log("Signing user op hash...");
      const signature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
      console.log("Signature generated, length:", signature.length);
      
      return signature;
    } catch (error) {
      console.error("Error signing user operation:", error);
      throw error;
    }
  }

  /**
   * Calculate the user operation hash locally, since our EntryPoint contract
   * doesn't expose a public getUserOpHash function
   */
  private calculateUserOpHash(userOp: UserOperationStruct): string {
    try {
      // This calculation must match the contract's _getUserOpHash implementation
      const packed = ethers.AbiCoder.defaultAbiCoder().encode(
        [
          'address', // sender
          'uint256', // nonce
          'bytes32', // initCodeHash
          'bytes32', // callDataHash
          'uint256', // callGasLimit
          'uint256', // verificationGasLimit
          'uint256', // preVerificationGas
          'uint256', // maxFeePerGas
          'uint256', // maxPriorityFeePerGas
          'bytes32', // paymasterAndDataHash
        ],
        [
          userOp.sender,
          userOp.nonce,
          ethers.keccak256(userOp.initCode || '0x'),
          ethers.keccak256(userOp.callData),
          userOp.callGasLimit,
          userOp.verificationGasLimit, 
          userOp.preVerificationGas,
          userOp.maxFeePerGas,
          userOp.maxPriorityFeePerGas,
          ethers.keccak256(userOp.paymasterAndData || '0x'),
        ]
      );
      
      // Include chain ID and EntryPoint address in the final hash
      const chainId = this.provider._network.chainId;
      const hash = ethers.keccak256(
        ethers.solidityPacked(
          ['bytes', 'uint256', 'address'],
          [packed, chainId, this.entryPoint.target]
        )
      );
      
      console.log("Calculated user op hash:", hash);
      return hash;
    } catch (error) {
      console.error("Error calculating user op hash:", error);
      throw error;
    }
  }
}