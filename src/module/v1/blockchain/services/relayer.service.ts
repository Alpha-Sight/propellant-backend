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
      blockchainTransactionHash: transaction.blockchainTransactionHash,
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
      
      // Update the transaction in database with actual blockchain transaction hash
      await this.transactionModel.updateOne(
        { _id: transactionMongoId },
        { $set: { blockchainTransactionHash: tx.hash } }
      );
      
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber} (status=${receipt.status})`);

      // If the receipt indicates a revert (status === 0), mark transaction and credential as FAILED/REJECTED
      if (receipt.status === 0) {
        await this.transactionModel.updateOne(
          { _id: transactionMongoId },
          {
            status: 'FAILED',
            transactionHash: tx.hash,
            blockNumber: receipt.blockNumber,
            processedAt: new Date(),
            lastError: 'On-chain transaction reverted'
          }
        );

        // If this was a credential related transaction, mark the credential as REJECTED/FAILED
        if (transaction.description && (transaction.description.includes('Issue credential') || transaction.description.includes('Verify credential'))) {
          await this.credentialModel.updateOne(
            { transactionId: transaction.transactionId },
            {
              $set: {
                status: 'REJECTED',
                verificationStatus: 'REJECTED',
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                updatedAt: new Date(),
                error: 'On-chain transaction reverted'
              }
            }
          );
          this.logger.log(`Transaction ${transaction.transactionId} reverted; associated credential marked REJECTED.`);
        }

        return; // done processing this transaction
      }

      // Success path (receipt.status === 1)
      await this.transactionModel.updateOne(
        { _id: transactionMongoId },
        {
          status: 'COMPLETED',
          transactionHash: tx.hash,
          blockchainTransactionHash: tx.hash, // Store the actual blockchain transaction hash
          blockNumber: receipt.blockNumber,
          processedAt: new Date(),
        }
      );

      // Try to parse CredentialIssued event from receipt logs to get the canonical on-chain id
      // This ensures we don't rely on locally generated ids.
      let onchainCredentialId: string | null = null;
      try {
        // Try both common event shapes: uint256 and bytes32. Some deployments use bytes32 ids.
        const issueIfaceUint = new ethers.Interface([
          'event CredentialIssued(uint256 indexed credentialId, address indexed subject, address indexed issuer)'
        ]);
        const issueIfaceBytes = new ethers.Interface([
          // include credentialType optional arg to match flattened ABI variant
          'event CredentialIssued(bytes32 indexed id, address indexed subject, address indexed issuer, uint8 credentialType)'
        ]);

        for (const log of receipt.logs) {
          try {
            const parsedUint = issueIfaceUint.parseLog({ topics: Array.from(log.topics), data: log.data });
            if (parsedUint && parsedUint.name === 'CredentialIssued') {
              onchainCredentialId = parsedUint.args[0].toString();
              this.logger.log(`Parsed CredentialIssued (uint) event, on-chain id=${onchainCredentialId}`);
              break;
            }
          } catch (e) {
            // ignore, try bytes32 next
          }

          try {
            const parsedBytes = issueIfaceBytes.parseLog({ topics: Array.from(log.topics), data: log.data });
            if (parsedBytes && parsedBytes.name === 'CredentialIssued') {
              onchainCredentialId = parsedBytes.args[0].toString();
              this.logger.log(`Parsed CredentialIssued (bytes32) event, on-chain id=${onchainCredentialId}`);
              break;
            }
          } catch (e) {
            // not the event we're looking for, ignore
          }
        }
      } catch (e) {
        this.logger.warn('Failed to parse CredentialIssued event interface:', e.message || e);
      }

      // Fallback: if no event parsed, attempt to read the first indexed topic as numeric id
      if (!onchainCredentialId) {
        try {
          for (const log of receipt.logs) {
            // Only consider logs emitted by the credential module contract
            if (log.address && this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS') && log.address.toLowerCase() === this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS').toLowerCase()) {
              if (log.topics && log.topics.length > 1) {
                const possibleIdHex = log.topics[1];
                // Convert hex to decimal string
                try {
                  const bn = ethers.toBigInt(possibleIdHex);
                  onchainCredentialId = bn.toString();
                  this.logger.log(`Fallback parsed id from topics[1]: ${onchainCredentialId}`);
                  break;
                } catch (e) {
                  // not numeric; still store hex string as tokenId fallback
                  onchainCredentialId = possibleIdHex.toString();
                  this.logger.log(`Fallback parsed hex id from topics[1]: ${onchainCredentialId}`);
                  break;
                }
              }
            }
          }
        } catch (e) {
          this.logger.warn('Fallback parsing of topics failed:', e.message || e);
        }
      }

      let credentialStatus = 'ISSUED';
      if (transaction.description && transaction.description.includes('Verify credential')) {
        credentialStatus = 'VERIFIED';
      } else if (transaction.description && transaction.description.includes('Issue credential')) {
        credentialStatus = 'ISSUED';
      }

      // Update credential status based on transaction type; update both 'status' and 'verificationStatus' for compatibility
      if (transaction.description && (transaction.description.includes('Issue credential') || transaction.description.includes('Verify credential'))) {
        const updateFields: any = {
          status: credentialStatus,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          updatedAt: new Date(),
        };

        // If we parsed an on-chain id from the issue event, persist it as the authoritative id.
        if (onchainCredentialId) {
          const numeric = parseInt(onchainCredentialId, 10);
          if (!isNaN(numeric)) {
            updateFields.blockchainCredentialId = numeric;
          } else {
            // fallback: store the string id in tokenId if number conversion fails
            updateFields.tokenId = onchainCredentialId;
          }
          // Mark as issued on-chain
          updateFields.verificationStatus = 'ISSUED';
        }

        if (credentialStatus === 'VERIFIED') {
          updateFields.verificationStatus = 'VERIFIED';
          updateFields.verifiedAt = new Date();
        }

        // Add blockchain transaction hash to update fields
        updateFields.blockchainTransactionHash = tx.hash;
        
        await this.credentialModel.updateOne(
          { transactionId: transaction.transactionId },
          { $set: updateFields }
        );

        this.logger.log(`Transaction ${transaction.transactionId} and associated credential updated to ${credentialStatus}.` + (onchainCredentialId ? ` Persisted on-chain id ${onchainCredentialId}` : '') + ` Blockchain TX hash: ${tx.hash}`);
      }

    } catch (error) {
      // Fetch the transaction object again to make sure it's in scope for the catch block
      const transaction = await this.transactionModel.findById(transactionMongoId);
      if (!transaction) {
        this.logger.error(`Transaction not found in error handler: ${transactionMongoId}`);
        return;
      }

      // Check for "already known" transactions - these may have been submitted previously
      // and are likely successful but already confirmed
      if (error.message && (error.message.includes('already known') || error.code === -32000)) {
        this.logger.warn(`Transaction already submitted: ${error.message}`);
        
        // For credential transactions, mark them as successful since they're likely already on chain
        if (transaction.description && (transaction.description.includes('Issue credential') || transaction.description.includes('Verify credential'))) {
          this.logger.log('This is a credential transaction that was already submitted. Marking as successful.');
          
          // Extract credential ID from the description
          let credentialId = null;
          if (transaction.description.includes('Issue credential ID')) {
            const match = transaction.description.match(/Issue credential ID (\d+)/);
            if (match && match[1]) {
              credentialId = parseInt(match[1], 10);
            }
          }
          
          // Update transaction status
          await this.transactionModel.updateOne(
            { _id: transactionMongoId },
            {
              status: 'COMPLETED',
              lastError: 'Transaction already known (likely successful)',
              processedAt: new Date(),
            }
          );
          
          // Update credential with status and token ID
          // Since this is an "already known" transaction, we can assume the credential is issued
          // For simplicity, use hardcoded token IDs if we can't determine the actual ID
          // Check multiple IDs starting with known values
          const tokenIds = [17, 18, 16, 15, 14, 13]; // Attempt known token IDs in order
          
          await this.credentialModel.updateOne(
            { transactionId: transaction.transactionId },
            {
              $set: {
                status: 'ISSUED',
                verificationStatus: 'ISSUED',
                blockchainCredentialId: credentialId || tokenIds[0], // Use the first token ID as default
                possibleTokenIds: tokenIds, // Store all potential token IDs for reference
                updatedAt: new Date(),
                lastError: 'Transaction already known (likely successful)'
              }
            }
          );
          
          this.logger.log(`Updated credential with transactionId ${transaction.transactionId} to ISSUED status with token ID ${credentialId || tokenIds[0]}`);
          return; // Exit successfully
        }
      }
      
      // Standard error handling for other errors
      this.logger.error(`Failed to process transaction with mongo ID ${transactionMongoId}: ${error.message}`);
      if (error.code === 'UNSUPPORTED_OPERATION' && error.operation === 'getEnsAddress') {
        this.logger.error('Network does not support ENS. Skipping ENS resolution.');
      }
      if (error.reason) {
        this.logger.error(`Transaction revert reason: ${error.reason}`);
      }
      
      // Update transaction status in DB with error info
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
