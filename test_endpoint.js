const API_BASE_URL = 'https://backendkqxs-1.onrender.com';

// Test function
async function testEndpoints() {
    console.log('🧪 Bắt đầu test API endpoints...\n');

    // Test 1: Lấy tất cả kết quả XSMB
    console.log('1️⃣ Test lấy tất cả kết quả XSMB:');
    try {
        const response = await fetch(`${API_BASE_URL}/api/kqxs/xsmb`);
        const data = await response.json();
        console.log('✅ Success:', data.length, 'kết quả');
        if (data.length > 0) {
            console.log('📊 Kết quả đầu tiên:', {
                drawDate: data[0].drawDate,
                dayOfWeek: data[0].dayOfWeek,
                station: data[0].station
            });
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n2️⃣ Test lấy kết quả theo thứ (thu-2):');
    try {
        const response = await fetch(`${API_BASE_URL}/api/kqxs/xsmb/thu-2`);
        const data = await response.json();
        console.log('✅ Success:', data.length, 'kết quả cho thứ 2');
        if (data.length > 0) {
            console.log('📊 Kết quả đầu tiên:', {
                drawDate: data[0].drawDate,
                dayOfWeek: data[0].dayOfWeek,
                station: data[0].station
            });
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n3️⃣ Test lấy kết quả theo ngày (hôm nay):');
    try {
        const today = new Date().toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).replace(/\//g, '-');
        
        const response = await fetch(`${API_BASE_URL}/api/kqxs/xsmb?date=${today}`);
        const data = await response.json();
        console.log('✅ Success:', data.length, 'kết quả cho ngày', today);
        if (data.length > 0) {
            console.log('📊 Kết quả đầu tiên:', {
                drawDate: data[0].drawDate,
                dayOfWeek: data[0].dayOfWeek,
                station: data[0].station
            });
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n4️⃣ Test lấy kết quả theo ngày cụ thể (01-01-2024):');
    try {
        const response = await fetch(`${API_BASE_URL}/api/kqxs/xsmb?date=01-01-2024`);
        const data = await response.json();
        console.log('✅ Success:', data.length, 'kết quả cho ngày 01-01-2024');
        if (data.length > 0) {
            console.log('📊 Kết quả đầu tiên:', {
                drawDate: data[0].drawDate,
                dayOfWeek: data[0].dayOfWeek,
                station: data[0].station
            });
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n🏁 Test hoàn thành!');
}

// Chạy test
testEndpoints(); 