// test-credential-flow.js
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
// You'll need to replace these with actual tokens
const ADMIN_EMAIL = 'admin@test.com'; // Change to your actual admin email
const ADMIN_PASSWORD = 'password123';   // Change to your actual admin password

async function checkServerHealth() {
  try {
    console.log('🔍 Checking server health...');
    // Try to hit a simple endpoint that should exist
    const response = await axios.get(`${BASE_URL}/auth/login`, {
      timeout: 5000,
      validateStatus: function (status) {
        // Accept 405 (Method Not Allowed) as it means the endpoint exists
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

async function testAuth() {
  try {
    console.log('\n🔐 Testing authentication...');
    
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    console.log('✅ Login successful');
    console.log('   - User role:', loginResponse.data.data?.user?.role);
    return loginResponse.data.data.access_token;
    
  } catch (error) {
    console.log('❌ Authentication failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 404) {
      console.log('   - The /auth/login endpoint might not exist');
      console.log('   - Check your AuthModule and routing');
    } else if (error.response?.status === 401) {
      console.log('   - Invalid credentials');
      console.log('   - Make sure you have a valid admin user:');
      console.log(`     Email: ${ADMIN_EMAIL}`);
      console.log(`     Password: ${ADMIN_PASSWORD}`);
      console.log('     Role: ADMIN or SUPER_ADMIN');
    }
    return null;
  }
}

async function testCredentialEndpoints(token) {
  console.log('\n📋 Testing credential endpoints...');
  
  // Test 1: Get credentials endpoint
  try {
    const response = await axios.get(`${BASE_URL}/credentials`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ GET /credentials works');
    console.log('   - Found', response.data.data?.length || 0, 'credentials');
    return response.data.data || [];
    
  } catch (error) {
    console.log('❌ GET /credentials failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 404) {
      console.log('   - The /credentials endpoint might not exist');
      console.log('   - Check your CredentialController routing');
    }
    return [];
  }
}

async function testCredentialVerification(token, credentialId) {
  try {
    console.log('\n✅ Testing credential verification...');
    
    const response = await axios.post(
      `${BASE_URL}/credentials/${credentialId}/verify`,
      {
        decision: 'VERIFIED',
        notes: 'Automated test verification - all documents look good'
      },
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Verification successful:', response.data);
    return response.data;
    
  } catch (error) {
    console.log('❌ Verification failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 404) {
      console.log('   - The verify endpoint might not exist');
      console.log('   - Check if your enhanced CredentialController is properly loaded');
    } else if (error.response?.status === 403) {
      console.log('   - User lacks permission to verify credentials');
      console.log('   - Make sure the user has ADMIN, SUPER_ADMIN, or ORGANIZATION role');
    } else if (error.response?.status === 400) {
      console.log('   - Bad request - check credential status and request format');
    }
    
    if (error.response?.data) {
      console.log('   - Response data:', JSON.stringify(error.response.data, null, 2));
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
    
    console.log('✅ Blockchain status:', response.data);
    return response.data;
    
  } catch (error) {
    console.log('❌ Blockchain status failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
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
    
    console.log('✅ Retry minting:', response.data);
    return response.data;
    
  } catch (error) {
    console.log('❌ Retry minting failed:');
    console.log('   - Status:', error.response?.status);
    console.log('   - Message:', error.response?.data?.message || error.message);
    
    // This might fail if credential isn't in the right state, which is expected
    if (error.response?.status === 400) {
      console.log('   - This is expected if credential isn\'t in VERIFIED state');
    }
    
    return null;
  }
}

async function checkAvailableRoutes(token) {
  console.log('\n🔍 Checking available routes...');
  
  const routesToTest = [
    { method: 'GET', path: '/credentials', description: 'Get credentials' },
    { method: 'GET', path: '/credentials/blockchain-status', description: 'Blockchain status' },
    { method: 'GET', path: '/auth/profile', description: 'User profile' },
  ];
  
  for (const route of routesToTest) {
    try {
      const response = await axios({
        method: route.method.toLowerCase(),
        url: `${BASE_URL}${route.path}`,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: function (status) {
          return status < 500; // Accept any non-server error
        }
      });
      
      console.log(`✅ ${route.method} ${route.path} - Status: ${response.status}`);
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${route.method} ${route.path} - Server not responding`);
      } else {
        console.log(`❌ ${route.method} ${route.path} - Error: ${error.message}`);
      }
    }
  }
}

async function runFullTest() {
  console.log('🚀 Starting Credential Flow Tests...\n');
  
  // Step 1: Check if server is running
  const serverRunning = await checkServerHealth();
  if (!serverRunning) {
    console.log('\n💡 Server troubleshooting:');
    console.log('   1. Check if your server is running on port 3000');
    console.log('   2. Check server logs for any startup errors');
    console.log('   3. Try: curl http://localhost:3000');
    return;
  }
  
  // Step 2: Test authentication
  const token = await testAuth();
  if (!token) {
    console.log('\n💡 Authentication troubleshooting:');
    console.log('   1. Check if AuthModule is properly configured');
    console.log('   2. Ensure you have a test admin user in your database');
    console.log('   3. Try creating a user through your existing endpoints');
    console.log(`\n   Example user creation (adjust email/password in script):`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Role: ADMIN`);
    return;
  }
  
  // Step 3: Check available routes
  await checkAvailableRoutes(token);
  
  // Step 4: Test credential endpoints
  const credentials = await testCredentialEndpoints(token);
  
  // Step 5: Test blockchain status (should work even without credentials)
  await testBlockchainStatus(token);
  
  // Step 6: If we have credentials, test verification
  if (credentials.length > 0) {
    const testCredentialId = credentials[0]._id;
    console.log('\n🎯 Using credential ID:', testCredentialId);
    
    await testCredentialVerification(token, testCredentialId);
    await testRetryMinting(token, testCredentialId);
  } else {
    console.log('\n💡 No credentials found for testing verification flow');
    console.log('   - Create a test credential first through your API');
    console.log('   - Then run this test again');
  }
  
  console.log('\n🏁 Test completed!');
  console.log('\n📊 Summary:');
  console.log('   - If most endpoints returned 404, check your routing configuration');
  console.log('   - If authentication failed, check your user database');
  console.log('   - If server connection failed, check if the server is actually running');
}

// Handle promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the test
runFullTest().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});