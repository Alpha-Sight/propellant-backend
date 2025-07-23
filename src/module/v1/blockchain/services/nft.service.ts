import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RelayerService } from './relayer.service';
import { Credential } from '../schemas/credential.schema';

@Injectable()
export class NftService implements OnModuleInit {
  private readonly logger = new Logger(NftService.name);
  private provider: ethers.JsonRpcProvider;
  private nftContract: ethers.Contract;

  constructor(
    private configService: ConfigService,
    private relayerService: RelayerService,
  ) {}

  async onModuleInit() {
    await this.initializeProvider();
  }

  private async initializeProvider() {
    try {
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
      const nftContractAddress = this.configService.get<string>('NFT_CONTRACT_ADDRESS');
      
      if (!rpcUrl || !nftContractAddress) {
        throw new Error('Missing required configuration for NFT service');
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Initialize contract ABI - this should be imported from your contract artifacts
      const nftABI = [
        'function safeMint(address to, string memory uri) external returns (uint256)',
        'function ownerOf(uint256 tokenId) external view returns (address)',
        'function tokenURI(uint256 tokenId) external view returns (string memory)'
      ];
      
      this.nftContract = new ethers.Contract(
        nftContractAddress,
        nftABI,
        this.provider
      );
      
      this.logger.log('NFT Service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize NFT service: ${error.message}`);
      throw error;
    }
  }

  async mintCredentialAsNft(credential: Credential, metadataUri: string): Promise<{ transactionId: string }> {
    try {
      this.logger.log(`Minting NFT for credential: ${credential.credentialId}`);
      
      // Encode the safeMint function call
      const iface = new ethers.Interface([
        'function safeMint(address to, string memory uri) external returns (uint256)'
      ]);
      
      const data = iface.encodeFunctionData('safeMint', [
        credential.subject,  // Recipient address (credential subject)
        metadataUri         // IPFS or other URI pointing to the credential metadata
      ]);

      // Queue the minting transaction through the relayer
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: credential.issuer,  // The issuer pays for the gas via the paymaster
        target: this.configService.get<string>('NFT_CONTRACT_ADDRESS'),
        value: '0',
        data,
        operation: 0,
        description: `Mint NFT for credential ${credential.credentialId}`,
        isAccountCreation: false,
      });

      this.logger.log(`NFT mint transaction queued: ${transactionResult.transactionId}`);
      
      return {
        transactionId: transactionResult.transactionId
      };
    } catch (error) {
      this.logger.error(`Failed to mint NFT for credential ${credential.credentialId}: ${error.message}`);
      throw error;
    }
  }

  async getNftMetadata(tokenId: string): Promise<{ owner: string; tokenUri: string }> {
    try {
      const owner = await this.nftContract.ownerOf(tokenId);
      const tokenUri = await this.nftContract.tokenURI(tokenId);
      
      return {
        owner,
        tokenUri
      };
    } catch (error) {
      this.logger.error(`Failed to fetch NFT metadata for token ${tokenId}: ${error.message}`);
      throw error;
    }
  }
}
