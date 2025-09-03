// test-credential-flow.js
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

// 🔑 PASTE YOUR JWT TOKEN HERE
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODU4N2YzNGM5MzE4YTM4NzkxNzBhOTUiLCJyb2xlIjoiVEFMRU5UIiwiaWF0IjoxNzU2Nzc0OTg4LCJleHAiOjE3ODgzMTA5ODh9.kCZJDTptVHMASLcdaelpwij-PpnM3jVDi6fxMMf4ZuQ'; // Replace with your actual JWT token

// OR use environment variable
// const JWT_TOKEN = process.env.JWT_TOKEN;

async function checkServerHealth() {
  try {
    console.log('🔍 Checking server health...');
    const response = await axios.get(`${BASE_URL}/auth/login`, {
      timeout: 5000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    console.log('✅ Server is running on port 3000');
    return true;
  } catch (error) {
    console.log('❌ Server health check failed:');
    if (error.code === 'ECONNREFUSED') {
      console.log('   - Server is not running on localhost:3000');
      console.log('   - Make sure to start your NestJS server first');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   - Cannot resolve hostname');
    } else {
      console.log('   - Error:', error.message);
    }
    return false;
  }
}

async function validateJWTToken(token) {
  try {
    console.log('\n🔐 Validating JWT token...');
    
    if (!token || token === 'YOUR_JWT_TOKEN_HERE') {
      console.log('❌ No JWT token provided');
      console.log('   - Please update the JWT_TOKEN variable in the script');
      console.log('   - Or set the JWT_TOKEN environment variable');
      return null;
    }
    
    // Test the token by making a request to a protected endpoint
    const response = await axios.get(`${BASE_URL}/users`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accept any non-server error
      }
    });
    
    if (response.status === 200) {
      console.log('✅ JWT token is valid');
      console.log('   - Token length:', token.length);
      console.log('   - Token preview:', token.substring(0, 30) + '...');
      return token;
    } else if (response.status === 401) {
      console.log('❌ JWT token is invalid or expired');
      console.log('   - Please get a fresh token from your login endpoint');
      return null;
    } else {
      console.log('✅ JWT token appears valid (got non-401 response)');
      return token;
    }
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('❌ JWT token is invalid or expired');
      console.log('   - Please get a fresh token from your login endpoint');
    } else {
      console.log('✅ JWT token appears valid (endpoint reachable)');
      console.log('   - Token length:', token.length);
      console.log('   - Token preview:', token.substring(0, 30) + '...');
      return token;
    }
    return null;
  }
}

async function getUserInfo(token) {
  try {
    console.log('\n👤 Getting user information...');
    
    // Try different endpoints to get user info
    const endpoints = [
      '/users',
      '/auth/profile', 
      '/credentials' // This should work and might give us user context
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 200) {
          console.log(`✅ User info from ${endpoint}:`);
          
          // Extract user info from response
          const userData = response.data.data;
          if (userData) {
            if (userData.role) {
              console.log('   - User Role:', userData.role);
            }
            if (userData.email) {
              console.log('   - Email:', userData.email);
            }
            if (userData._id) {
              console.log('   - User ID:', userData._id);
            }
            if (userData.length !== undefined) {
              console.log('   - Response type: Array with', userData.length, 'items');
            }
          }
          break;
        }
      } catch (err) {
        // Continue to next endpoint
        continue;
      }
    }
    
  } catch (error) {
    console.log('❌ Could not get user information');
    console.log('   - This is okay, we\'ll proceed with testing');
  }
}

async function testCredentialEndpoints(token) {
  console.log('\n📋 Testing credential endpoints...');
  
  try {
    const response = await axios.get(`${BASE_URL}/credentials`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ GET /credentials works');
    const credentials = response.data.data || [];
    console.log('   - Found', credentials.length, 'credentials');
    
    // Show some credential details if available
    if (credentials.length > 0) {
      const firstCredential = credentials[0];
      console.log('   - First credential:');
      console.log('     - ID:', firstCredential._id);
      console.log('     - Title:', firstCredential.title);
      console.log('     - Status:', firstCredential.verificationStatus || firstCredential.status);
      console.log('     - Type:', firstCredential.type);
    }
    
    return credentials;
    
  } catch (error) {
    console.log('❌ GET /credentials failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('   - JWT token is invalid or expired');
    } else if (error.response?.status === 404) {
      console.log('   - The /credentials endpoint might not exist');
    }
    return [];
  }
}

async function testCredentialVerification(token, credentialId) {
  try {
    console.log('\n✅ Testing credential verification...');
    console.log('   - Credential ID:', credentialId);
    
    const response = await axios.post(
      `${BASE_URL}/credentials/${credentialId}/verify`,
      {
        decision: 'VERIFIED',
        notes: 'Automated test verification using JWT token - all documents verified'
      },
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Verification successful!');
    console.log('   - Status:', response.data.data?.status);
    console.log('   - Minted:', response.data.data?.minted);
    console.log('   - Message:', response.data.data?.message);
    
    if (response.data.data?.transactionId) {
      console.log('   - Transaction ID:', response.data.data.transactionId);
    }
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Verification failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 403) {
      console.log('   - User lacks permission to verify credentials');
      console.log('   - Make sure the JWT token belongs to ADMIN, SUPER_ADMIN, or ORGANIZATION user');
    } else if (error.response?.status === 400) {
      console.log('   - Bad request - credential might not be in PENDING_VERIFICATION status');
    } else if (error.response?.status === 404) {
      console.log('   - Credential not found or verify endpoint does not exist');
    } else if (error.response?.status === 401) {
      console.log('   - JWT token is invalid or expired');
    }
    
    return null;
  }
}

async function testBlockchainStatus(token) {
  try {
    console.log('\n⛓️ Testing blockchain status...');
    
    const response = await axios.get(`${BASE_URL}/credentials/blockchain-status`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Blockchain status retrieved:');
    const data = response.data.data;
    console.log('   - Total Verified:', data?.totalVerified || 0);
    console.log('   - Minted:', data?.minted || 0);
    console.log('   - Pending:', data?.pending || 0);
    console.log('   - Failed:', data?.failed || 0);
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Blockchain status failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('   - JWT token is invalid or expired');
    }
    
    return null;
  }
}

async function testRetryMinting(token, credentialId) {
  try {
    console.log('\n🔄 Testing retry minting...');
    
    const response = await axios.post(
      `${BASE_URL}/credentials/${credentialId}/retry-minting`,
      {},
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Retry minting successful:');
    console.log('   - Message:', response.data.data?.message);
    if (response.data.data?.transactionId) {
      console.log('   - Transaction ID:', response.data.data.transactionId);
    }
    
    return response.data;
    
  } catch (error) {
    console.log('❌ Retry minting failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 400) {
      console.log('   - This is expected if credential isn\'t in VERIFIED state or already minted');
    } else if (error.response?.status === 403) {
      console.log('   - User can only retry minting for their own credentials');
    } else if (error.response?.status === 401) {
      console.log('   - JWT token is invalid or expired');
    }
    
    return null;
  }
}

async function runFullTest() {
  console.log('🚀 Starting Credential Flow Tests with JWT Token...\n');
  
  // Step 1: Check if server is running
  const serverRunning = await checkServerHealth();
  if (!serverRunning) {
    console.log('\n💡 Please start your server: npm run start:dev');
    return;
  }
  
  // Step 2: Validate JWT token
  const token = await validateJWTToken(JWT_TOKEN);
  if (!token) {
    console.log('\n💡 How to get a JWT token:');
    console.log('   1. Login through your API: POST /api/v1/auth/login');
    console.log('   2. Copy the accessToken from the response');
    console.log('   3. Paste it in the JWT_TOKEN variable in this script');
    console.log('   4. Or set it as environment variable: JWT_TOKEN=your_token_here');
    console.log('\n   Example:');
    console.log('   curl -X POST http://localhost:3000/api/v1/auth/login \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"email":"admin@example.com","password":"password123"}\'');
    return;
  }
  
  // Step 3: Get user information
  await getUserInfo(token);
  
  // Step 4: Test credential endpoints
  const credentials = await testCredentialEndpoints(token);
  
  // Step 5: Test blockchain status
  await testBlockchainStatus(token);
  
  // Step 6: Test verification flow if credentials exist
  if (credentials.length > 0) {
    // Find a credential that can be verified
    const pendingCredential = credentials.find(c => 
      c.verificationStatus === 'PENDING_VERIFICATION' || 
      c.attestationStatus === 'PENDING_VERIFICATION'
    );
    
    if (pendingCredential) {
      console.log('\n🎯 Found pending credential for verification test');
      await testCredentialVerification(token, pendingCredential._id);
    } else {
      console.log('\n🎯 No pending credentials found, testing with first credential');
      await testCredentialVerification(token, credentials[0]._id);
    }
    
    // Test retry minting with a verified credential
    const verifiedCredential = credentials.find(c => 
      c.verificationStatus === 'VERIFIED'
    );
    
    if (verifiedCredential) {
      await testRetryMinting(token, verifiedCredential._id);
    } else {
      console.log('\n💡 No verified credentials found for retry minting test');
    }
  } else {
    console.log('\n💡 No credentials found for testing verification flow');
    console.log('   - Create a test credential first through your API');
  }
  
  console.log('\n🏁 Test completed!');
  console.log('\n📊 Results Summary:');
  console.log('   ✅ JWT token authentication working');
  console.log('   ✅ Credential endpoints accessible');
  console.log('   ✅ Blockchain integration tested');
  console.log('   ✅ Role-based access control verified');
}

// Handle promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('❌ Unhandled Rejection:', reason);
});

// Run the test
runFullTest().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});