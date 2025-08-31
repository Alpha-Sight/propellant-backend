import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { ethers } from 'ethers';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Credential } from '../module/v1/blockchain/schemas/credential.schema';
import { BlockchainTransaction } from '../module/v1/blockchain/schemas/transaction.schema';

/**
 * This script finds and fixes stuck credentials that were actually minted on the blockchain
 * but are stuck in PENDING status in the database due to "already known" transaction errors
 */

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('FixStuckCredentials');
  const configService = app.get(ConfigService);

  try {
    logger.log('Starting fix-stuck-credentials script');

    // Get MongoDB models
    const credentialModel = app.get<Model<Credential>>(getModelToken(Credential.name));
    const transactionModel = app.get<Model<BlockchainTransaction>>(getModelToken(BlockchainTransaction.name));

    // Get blockchain config
    const rpcUrl = configService.get<string>('BLOCKCHAIN_RPC_URL');
    const credentialModuleAddress = configService.get<string>('CREDENTIAL_VERIFICATION_MODULE_ADDRESS');

    if (!rpcUrl || !credentialModuleAddress) {
      throw new Error('Missing blockchain configuration');
    }

    logger.log(`Using RPC URL: ${rpcUrl}`);
    logger.log(`Using credential module address: ${credentialModuleAddress}`);

    // Create blockchain provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Create contract instance with minimal ABI needed for token checks
    const credentialModule = new ethers.Contract(
      credentialModuleAddress,
      [
        'function ownerOf(uint256 tokenId) external view returns (address)',
        'function tokenURI(uint256 tokenId) external view returns (string memory)',
        'function getCredential(uint256 credentialId) external view returns (tuple(address issuer, address subject, string name, string description, uint8 status))',
        'function balanceOf(address owner) external view returns (uint256)',
        'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
      ],
      provider
    );

    // Find pending credentials with transactions
    const pendingCredentials = await credentialModel.find({
      $or: [
        { status: 'PENDING' },
        { status: 'PENDING_BLOCKCHAIN' },
        { verificationStatus: 'PENDING' },
        { verificationStatus: 'PENDING_BLOCKCHAIN' }
      ],
      transactionId: { $exists: true, $ne: null }
    });

    logger.log(`Found ${pendingCredentials.length} pending credentials with transactions`);

    // Check each credential
    for (const credential of pendingCredentials) {
      try {
        logger.log(`Checking credential: ${credential._id}, transactionId: ${credential.transactionId}`);
        
        // Get transaction status
        const transaction = await transactionModel.findOne({ transactionId: credential.transactionId });
        
        if (!transaction) {
          logger.warn(`Transaction ${credential.transactionId} not found for credential ${credential._id}`);
          continue;
        }
        
        // Check if this is a transaction that failed with "already known" error
        if (transaction.status === 'FAILED' && 
            transaction.lastError && 
            transaction.lastError.includes('already known')) {
          logger.log(`Found "already known" transaction error for credential ${credential._id}`);
          
          // Check if credential is actually on the blockchain
          let found = false;
          let tokenId = null;
          
          // First try the blockchainCredentialId if it exists
          if (credential.blockchainCredentialId) {
            try {
              const owner = await credentialModule.ownerOf(credential.blockchainCredentialId);
              
              if (owner && owner !== ethers.ZeroAddress) {
                logger.log(`Found credential on blockchain with ID ${credential.blockchainCredentialId}`);
                found = true;
                tokenId = credential.blockchainCredentialId;
              }
            } catch (error) {
              logger.warn(`Error checking blockchainCredentialId ${credential.blockchainCredentialId}: ${error.message}`);
            }
          }
          
          // If not found by blockchainCredentialId, try specific token IDs we've seen in logs
          if (!found) {
            const tokenIds = [17, 18, 16, 15, 14, 13];
            
            for (const id of tokenIds) {
              try {
                const owner = await credentialModule.ownerOf(id);
                
                if (owner && owner !== ethers.ZeroAddress) {
                  // Check if this token belongs to our credential's subject
                  if (owner.toLowerCase() === credential.subject.toLowerCase()) {
                    // Get credential details to confirm it's the right one
                    try {
                      const details = await credentialModule.getCredential(id);
                      
                      if (details && 
                          details[1].toLowerCase() === credential.subject.toLowerCase() &&
                          details[2] === credential.name) {
                        logger.log(`Found credential on blockchain with ID ${id}`);
                        found = true;
                        tokenId = id;
                        break;
                      }
                    } catch (detailsError) {
                      // If we can't get details but know the token exists and belongs to this wallet,
                      // it's probably our credential
                      logger.warn(`Could not get credential details: ${detailsError.message}`);
                      logger.log(`Token ${id} exists and belongs to ${owner}, assuming it's our credential`);
                      found = true;
                      tokenId = id;
                      break;
                    }
                  }
                }
              } catch (error) {
                // Token doesn't exist, try the next one
              }
            }
          }
          
          // If credential found on blockchain, update the database
          if (found && tokenId) {
            logger.log(`Fixing stuck credential ${credential._id} with token ID ${tokenId}`);
            
            await credentialModel.updateOne(
              { _id: credential._id },
              {
                $set: {
                  status: 'ISSUED',
                  verificationStatus: 'ISSUED',
                  blockchainCredentialId: tokenId,
                  updatedAt: new Date(),
                  lastError: 'Fixed by script: Transaction was successful despite "already known" error'
                }
              }
            );
            
            // Also update the transaction
            await transactionModel.updateOne(
              { transactionId: credential.transactionId },
              {
                $set: {
                  status: 'COMPLETED',
                  lastError: 'Fixed by script: Transaction was successful despite "already known" error',
                  processedAt: new Date()
                }
              }
            );
            
            logger.log(`Successfully fixed credential ${credential._id} with token ID ${tokenId}`);
          } else {
            logger.warn(`Could not find credential ${credential._id} on blockchain`);
          }
        }
      } catch (error) {
        logger.error(`Error processing credential ${credential._id}: ${error.message}`);
      }
    }

    logger.log('Script completed');
  } catch (error) {
    logger.error(`Script failed: ${error.message}`, error.stack);
  } finally {
    await app.close();
  }
}

bootstrap();
