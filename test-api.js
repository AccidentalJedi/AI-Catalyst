const axios = require('axios');

async function testBusinessFormationAPI() {
  try {
    console.log('Testing AI Catalyst Business Formation API...');
    
    // Test health endpoint first
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Health check:', healthResponse.data);
    
    // Test business formation endpoint
    console.log('\n2. Testing business formation endpoint...');
    const businessData = {
      businessName: "Test AI Catalyst LLC",
      businessType: "LLC",
      state: "TX",
      registeredAgent: {
        name: "John Doe",
        address: "123 Main St, Austin, TX 78701"
      },
      businessAddress: {
        street: "456 Business Ave",
        city: "Austin",
        state: "TX",
        zipCode: "78701"
      },
      ownerInfo: {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: "555-0123"
      }
    };
    
    const businessResponse = await axios.post(
      'http://localhost:3001/api/v1/business/form',
      businessData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      }
    );
    
    console.log('✅ Business formation response:', businessResponse.data);
    
    // Test DocuSign authentication endpoint
    console.log('\n3. Testing DocuSign authentication...');
    const docusignResponse = await axios.post(
      'http://localhost:3001/api/v1/docusign/authenticate',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      }
    );
    
    console.log('✅ DocuSign auth response:', docusignResponse.data);
    
  } catch (error) {
    console.error('❌ API Test Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

testBusinessFormationAPI();
