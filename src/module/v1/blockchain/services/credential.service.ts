import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RelayerService } from './relayer.service';
import * as CredentialVerificationModuleABI from '../abis/CredentialVerificationModule.json';
import { MintCredentialDto } from '../dto/mint-credential.dto';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);
  private provider: ethers.JsonRpcProvider;
  private credentialModule: ethers.Contract;

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
      const credentialModuleAddress = this.configService.get<string>(
        'CREDENTIAL_VERIFICATION_MODULE_ADDRESS',
      );

      this.credentialModule = new ethers.Contract(
        credentialModuleAddress,
        CredentialVerificationModuleABI.abi,
        this.provider,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize credential service: ${error.message}`,
      );
    }
  }

  async mintCredential(payload: MintCredentialDto, issuerId: string) {
    try {
      const {
        subject,
        name,
        description,
        metadataURI,
        credentialType,
        validUntil,
        evidenceHash,
        revocable,
      } = payload;

      // Encode the function call
      const iface = new ethers.Interface([
        'function issueCredential(address subject, string name, string description, string metadataURI, uint8 credentialType, uint256 validUntil, bytes32 evidenceHash, bool revocable) returns (uint256)',
      ]);

      const data = iface.encodeFunctionData('issueCredential', [
        subject,
        name,
        description,
        metadataURI,
        credentialType,
        validUntil || 0,
        evidenceHash,
        revocable,
      ]);

      // Queue the transaction using the relayer
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress:
          this.configService.get<string>('RELAYER_ADDRESS') || subject,
        target: this.configService.get<string>(
          'CREDENTIAL_VERIFICATION_MODULE_ADDRESS',
        ),
        value: '0',
        data,
        operation: 0,
        description: `Mint credential "${name}" for ${subject}`,
        isAccountCreation: false,
      });

      this.logger.log(
        `Credential minting transaction queued with ID: ${transactionResult.transactionId}`,
      );

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        subject,
        name,
        description,
      };
    } catch (error) {
      this.logger.error(`Failed to mint credential: ${error.message}`);
      throw error;
    }
  }

  async getCredentialsForWallet(walletAddress: string) {
    try {
      // First check if the contract is properly initialized
      try {
        // A simple call to check if the contract responds
        await this.credentialModule.isCredentialValid(0);
      } catch (error) {
        if (error.message.includes('implementation not set')) {
          this.logger.warn(
            `Contract at ${this.configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS')} is not properly initialized`,
          );
          return []; // Return empty array instead of failing
        }
      }

      const credentialIds =
        await this.credentialModule.getCredentialsForSubject(walletAddress);

      if (!credentialIds.length) {
        return [];
      }

      // Get details for each credential
      const credentials = [];
      for (const id of credentialIds) {
        try {
          const credential = await this.credentialModule.getCredential(id);
          credentials.push({
            id: id.toString(),
            issuer: credential.issuer,
            subject: credential.subject,
            name: credential.name,
            description: credential.description,
            metadataURI: credential.metadataURI,
            credentialType: credential.credentialType,
            status: this.mapCredentialStatus(credential.status),
            issuedAt: new Date(
              Number(credential.issuedAt) * 1000,
            ).toISOString(),
            validUntil:
              credential.validUntil > 0
                ? new Date(Number(credential.validUntil) * 1000).toISOString()
                : null,
          });
        } catch (error) {
          this.logger.error(
            `Error fetching credential ${id}: ${error.message}`,
          );
        }
      }

      return credentials;
    } catch (error) {
      this.logger.error(
        `Failed to get credentials for wallet: ${error.message}`,
      );

      // Return empty array for better user experience
      return [];
    }
  }

  async verifyCredential(credentialId: string, verifierId: string) {
    try {
      // Encode the function call
      const iface = new ethers.Interface([
        'function verifyCredential(uint256 tokenId, uint8 status, string notes) returns (bool)',
      ]);

      const data = iface.encodeFunctionData('verifyCredential', [
        credentialId,
        1, // VERIFIED status
        'Verified by PropellantBD administrator',
      ]);

      // Queue the transaction using the relayer
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: this.configService.get<string>('RELAYER_ADDRESS'),
        target: this.configService.get<string>(
          'CREDENTIAL_VERIFICATION_MODULE_ADDRESS',
        ),
        value: '0',
        data,
        operation: 0,
        description: `Verify credential ID ${credentialId}`,
        isAccountCreation: false,
      });

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId,
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
        'function revokeCredential(uint256 tokenId, string reason) returns (bool)',
      ]);

      const data = iface.encodeFunctionData('revokeCredential', [
        credentialId,
        'Revoked by PropellantBD administrator',
      ]);

      // Queue the transaction using the relayer
      const transactionResult = await this.relayerService.queueTransaction({
        userAddress: this.configService.get<string>('RELAYER_ADDRESS'),
        target: this.configService.get<string>(
          'CREDENTIAL_VERIFICATION_MODULE_ADDRESS',
        ),
        value: '0',
        data,
        operation: 0,
        description: `Revoke credential ID ${credentialId}`,
        isAccountCreation: false,
      });

      return {
        transactionId: transactionResult.transactionId,
        status: transactionResult.status,
        credentialId,
      };
    } catch (error) {
      this.logger.error(`Failed to revoke credential: ${error.message}`);
      throw error;
    }
  }

  private mapCredentialStatus(status: number): string {
    const statuses = ['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED'];
    return statuses[status] || 'UNKNOWN';
  }
}
