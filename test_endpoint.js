const axios = require('axios');

async function testEndpoint() {
    try {
        const response = await axios.get('http://localhost:5001/api/users/new-registrations');
        console.log('Response status:', response.status);
        console.log('Response data:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.status, error.response?.data || error.message);
    }
}

testEndpoint(); 