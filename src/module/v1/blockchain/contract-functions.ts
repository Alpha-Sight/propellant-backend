import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
dotenv.config();
import * as ethers from 'ethers';

const logger = new Logger('ContractFunctions');

// List of common function signatures to check
const COMMON_FUNCTIONS = [
  // Basic ERC721 and extensions
  'name()', 'symbol()', 'balanceOf(address)', 'ownerOf(uint256)', 
  'approve(address,uint256)', 'getApproved(uint256)',
  'isApprovedForAll(address,address)', 'setApprovalForAll(address,bool)',
  'transferFrom(address,address,uint256)', 'safeTransferFrom(address,address,uint256)',
  'safeTransferFrom(address,address,uint256,bytes)',
  'supportsInterface(bytes4)', 'tokenURI(uint256)', 'totalSupply()',
  
  // Minting related functions
  'mint(address,uint256)', 'mint(address,string)', 'mint(address,uint256,string)',
  'mintTo(address,string)', 'mintTo(address,uint256)',
  'safeMint(address,uint256)', 'safeMint(address,string)',
  'mintWithTokenURI(address,uint256,string)', 
  
  // Credential-specific
  'issueCredential(address,string,string)', 'issueCredential(address,uint256,string)',
  'mintCredential(address,string,string)', 'createCredential(address,string,string)',
  
  // Access control
  'grantRole(bytes32,address)', 'revokeRole(bytes32,address)', 'renounceRole(bytes32,address)',
  'hasRole(bytes32,address)', 'getRoleMember(bytes32,uint256)', 'getRoleMemberCount(bytes32)',
  'DEFAULT_ADMIN_ROLE()', 'MINTER_ROLE()',
  
  // Custom credential roles
  'CREDENTIAL_MINTER_ROLE()', 'CREDENTIAL_ISSUER_ROLE()', 'CREDENTIAL_ADMIN_ROLE()',
  'CREDENTIAL_VERIFIER_ROLE()',
];

async function findContractFunctions() {
  const { BLOCKCHAIN_RPC_URL, CREDENTIAL_VERIFICATION_MODULE_ADDRESS, RELAYER_PRIVATE_KEY } = process.env;
  
  if (!BLOCKCHAIN_RPC_URL || !CREDENTIAL_VERIFICATION_MODULE_ADDRESS || !RELAYER_PRIVATE_KEY) {
    logger.error('Missing required environment variables');
    return;
  }
  
  try {
    const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_RPC_URL);
    const contractAddress = CREDENTIAL_VERIFICATION_MODULE_ADDRESS;
    
    // Get both wallet instances
    const wallet1 = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const wallet2 = new ethers.Wallet('7b9c31c135fca75b7e7596f947ec47dafd046c9cd8e2f7b07024d27f8c0a2bc8', provider);
    
    logger.log('Contract Function Finder');
    logger.log('----------------------------------------');
    logger.log(`Contract address: ${contractAddress}`);
    logger.log(`Testing with wallet1: ${wallet1.address}`);
    
    // Check each function
    const foundFunctions = [];
    
    for (const funcSig of COMMON_FUNCTIONS) {
      try {
        // Create a minimal ABI for this function
        const abi = [`function ${funcSig}`];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        
        // Get function name and argument count
        const funcName = funcSig.split('(')[0];
        const hasArgs = funcSig.indexOf('(') < funcSig.indexOf(')') - 1;
        
        // For view functions, we can try to call them directly
        if (funcSig.includes('view') || 
            ['name', 'symbol', 'totalSupply', 'DEFAULT_ADMIN_ROLE', 'MINTER_ROLE'].includes(funcName)) {
          
          try {
            const result = await contract[funcName]();
            logger.log(`✅ ${funcSig} -> ${result}`);
            foundFunctions.push(funcSig);
          } catch (e) {
            if (e.message.includes('method not found') || 
                e.message.includes('invalid fragment') || 
                e.message.includes('call revert exception')) {
              // Function doesn't exist
            } else {
              // Function exists but call failed for other reasons
              logger.log(`❓ ${funcSig} (exists but call failed)`);
              foundFunctions.push(funcSig);
            }
          }
        } 
        // For non-view functions, we try to estimate gas
        else {
          // Skip functions that take arguments, as we would need to provide valid arguments
          if (!hasArgs) {
            try {
              // Try with both wallets
              const contractWithWallet1 = new ethers.Contract(contractAddress, abi, wallet1);
              
              // Use estimateGas to see if the function exists, without sending a tx
              await contractWithWallet1.getFunction(funcName).estimateGas();
              logger.log(`✅ ${funcSig} (can call with wallet1)`);
              foundFunctions.push(funcSig);
            } catch (e) {
              if (e.message.includes('method not found') || 
                  e.message.includes('invalid fragment') ||
                  e.message.includes('no matching function')) {
                // Function doesn't exist
              } else {
                // Function exists but call failed for permission reasons
                logger.log(`❓ ${funcSig} (exists but call failed with wallet1)`);
                
                // Try with wallet2
                try {
                  const contractWithWallet2 = new ethers.Contract(contractAddress, abi, wallet2);
                  await contractWithWallet2.getFunction(funcName).estimateGas();
                  logger.log(`✅ ${funcSig} (can call with wallet2)`);
                  foundFunctions.push(funcSig);
                } catch (e) {
                  if (!e.message.includes('method not found') && 
                      !e.message.includes('invalid fragment') &&
                      !e.message.includes('no matching function')) {
                    logger.log(`❌ ${funcSig} (exists but call failed with both wallets)`);
                    foundFunctions.push(funcSig);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip errors related to invalid function signatures
      }
    }
    
    // List of found functions
    logger.log('\nFOUND FUNCTIONS:');
    logger.log('----------------------------------------');
    for (const func of foundFunctions) {
      logger.log(`- ${func}`);
    }
    
    // Now try known ERC721 + AccessControl interface
    logger.log('\nTrying with full ERC721 + AccessControl interface...');
    const fullABI = [
      // ERC721
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function tokenURI(uint256) view returns (string)',
      'function balanceOf(address) view returns (uint256)',
      'function ownerOf(uint256) view returns (address)',
      'function totalSupply() view returns (uint256)',
      
      // AccessControl
      'function hasRole(bytes32,address) view returns (bool)',
      'function getRoleAdmin(bytes32) view returns (bytes32)',
      'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
      
      // Credential verification methods
      'function mintCredential(address,string,string) returns (uint256)',
      'function issueCredential(address,string,string) returns (uint256)',
      'function verifyCredential(uint256) returns (bool)',
      'function revokeCredential(uint256)',
      
      // Custom role
      'function CREDENTIAL_MINTER_ROLE() view returns (bytes32)',
      'function CREDENTIAL_ISSUER_ROLE() view returns (bytes32)',
    ];
    
    const fullContract = new ethers.Contract(contractAddress, fullABI, wallet1);
    
    // Get standard information
    try {
      const name = await fullContract.name();
      const symbol = await fullContract.symbol();
      const totalSupply = await fullContract.totalSupply();
      
      logger.log(`Contract Name: ${name}`);
      logger.log(`Contract Symbol: ${symbol}`);
      logger.log(`Total Supply: ${totalSupply.toString()}`);
    } catch (e) {
      logger.log('Could not retrieve basic token information');
    }
    
    // Check for custom roles
    try {
      const adminRole = await fullContract.DEFAULT_ADMIN_ROLE();
      logger.log(`DEFAULT_ADMIN_ROLE: ${adminRole}`);
      
      // Try custom roles
      const customRoles = [
        'CREDENTIAL_MINTER_ROLE', 
        'CREDENTIAL_ISSUER_ROLE',
        'CREDENTIAL_ADMIN_ROLE',
        'MINTER_ROLE'
      ];
      
      for (const roleName of customRoles) {
        try {
          const role = await fullContract[roleName]();
          logger.log(`${roleName}: ${role}`);
          
          // Check if wallets have this role
          const wallet1HasRole = await fullContract.hasRole(role, wallet1.address);
          const wallet2HasRole = await fullContract.hasRole(role, wallet2.address);
          
          logger.log(`- Wallet1 has ${roleName}: ${wallet1HasRole}`);
          logger.log(`- Wallet2 has ${roleName}: ${wallet2HasRole}`);
        } catch (e) {
          // This role doesn't exist
        }
      }
    } catch (e) {
      logger.log(`Error checking roles: ${e.message}`);
    }
    
  } catch (error) {
    logger.error(`Error finding functions: ${error.message}`);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  findContractFunctions()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
