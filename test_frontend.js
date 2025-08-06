// Test frontend logic
console.log('🧪 Test frontend logic...\n');

// Test 1: Props mapping
const testProps = {
    data3: '01-01-2024', // date
    data4: 'thu-2',      // dayof
    station: 'xsmb'
};

console.log('1️⃣ Test props mapping:');
console.log('data3 (date):', testProps.data3);
console.log('data4 (dayof):', testProps.data4);
console.log('station:', testProps.station);

// Test 2: Cache key generation
const station = testProps.station || "xsmb";
const date = testProps.data3;
const dayof = testProps.data4;
const CACHE_KEY = `xsmb_data_${station}_${date || 'null'}_${dayof || 'null'}`;

console.log('\n2️⃣ Test cache key generation:');
console.log('CACHE_KEY:', CACHE_KEY);

// Test 3: API URL generation
let url = 'https://backendkqxs-1.onrender.com/api/kqxs';

if (dayof) {
    url = `${url}/xsmb/${dayof}`;
} else if (station && date) {
    url = `${url}/xsmb?date=${date}`;
} else {
    url = `${url}/xsmb`;
}

console.log('\n3️⃣ Test API URL generation:');
console.log('URL:', url);

// Test 4: Day mapping
const dayMap = {
    'thu-2': 'Thứ 2',
    'thu-3': 'Thứ 3',
    'thu-4': 'Thứ 4',
    'thu-5': 'Thứ 5',
    'thu-6': 'Thứ 6',
    'thu-7': 'Thứ 7',
    'chu-nhat': 'Chủ nhật'
};

console.log('\n4️⃣ Test day mapping:');
console.log('thu-2 ->', dayMap['thu-2']);
console.log('thu-3 ->', dayMap['thu-3']);
console.log('chu-nhat ->', dayMap['chu-nhat']);

console.log('\n🏁 Test hoàn thành!'); 