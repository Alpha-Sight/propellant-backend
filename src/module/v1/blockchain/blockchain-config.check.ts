import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

const logger = new Logger('BlockchainConfigCheck');

// This file can be imported to verify blockchain configuration
export function checkBlockchainConfig() {
  const { 
    BLOCKCHAIN_RPC_URL, 
    RELAYER_PRIVATE_KEY, 
    CREDENTIAL_VERIFICATION_MODULE_ADDRESS 
  } = process.env;

  // Check if the required environment variables are set
  const missingVars = [];
  if (!BLOCKCHAIN_RPC_URL) missingVars.push('BLOCKCHAIN_RPC_URL');
  if (!RELAYER_PRIVATE_KEY) missingVars.push('RELAYER_PRIVATE_KEY');
  if (!CREDENTIAL_VERIFICATION_MODULE_ADDRESS) missingVars.push('CREDENTIAL_VERIFICATION_MODULE_ADDRESS');

  if (missingVars.length > 0) {
    logger.error(`Missing blockchain configuration: ${missingVars.join(', ')}`);
    return false;
  }

  // Log the configuration (with masked private key)
  logger.log('Blockchain configuration found:');
  logger.log(`RPC URL: ${BLOCKCHAIN_RPC_URL}`);
  logger.log(`Relayer Private Key: ${RELAYER_PRIVATE_KEY ? '✓ (configured)' : '❌ (missing)'}`);
  logger.log(`Credential Module Address: ${CREDENTIAL_VERIFICATION_MODULE_ADDRESS}`);
  
  return true;
}

// Add this to bootstrap or app.module to check on startup
export function verifyBlockchainConfigOnStartup() {
  const configValid = checkBlockchainConfig();
  if (!configValid) {
    logger.warn('⚠️ Blockchain configuration is incomplete. Minting features will not work correctly.');
  } else {
    logger.log('✅ Blockchain configuration validated successfully.');
  }
}

// Export a function to test the blockchain connection
export async function testBlockchainConnection() {
  try {
    const ethers = require('ethers');
    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    logger.log(`Connected to blockchain network: ${network.name} (${network.chainId})`);
    logger.log(`Current block number: ${blockNumber}`);
    
    return {
      success: true,
      network: network.name,
      chainId: network.chainId.toString(),
      blockNumber
    };
  } catch (error) {
    logger.error(`Failed to connect to blockchain: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// You can run this directly to test configuration
if (require.main === module) {
  checkBlockchainConfig();
  testBlockchainConnection().then(result => {
    if (result.success) {
      logger.log('Blockchain connection test successful! 🚀');
    } else {
      logger.error('Blockchain connection test failed! ❌');
    }
  });
}
