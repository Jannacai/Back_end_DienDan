// Test logic cache và API call
console.log('🧪 Test logic cache và API call...\n');

// Test 1: Logic clear cache
const testClearCache = () => {
    console.log('1️⃣ Test clear cache logic:');

    const date = '03-08-2025';
    const dayof = 'thu-2';
    const CACHE_KEY = `xsmb_data_xsmb_${date || 'null'}_${dayof || 'null'}`;

    console.log('CACHE_KEY:', CACHE_KEY);
    console.log('Has date:', !!date);
    console.log('Has dayof:', !!dayof);
    console.log('Should clear cache:', !!(date || dayof));

    // Simulate clear cache
    if (date || dayof) {
        console.log('🗑️ Clear cache cũ vì có date hoặc dayof:', { date, dayof });
        // localStorage.removeItem(CACHE_KEY);
        // localStorage.removeItem(`${CACHE_KEY}_time`);
        console.log('✅ Cache đã được clear');
    }
};

// Test 2: Logic shouldFetchFromAPI
const testShouldFetchFromAPI = () => {
    console.log('\n2️⃣ Test shouldFetchFromAPI logic:');

    const date = '03-08-2025';
    const dayof = 'thu-2';
    const forceRefresh = false;
    const cachedData = null;
    const cacheAge = Infinity;

    const shouldFetchFromAPI =
        forceRefresh ||
        (date || dayof) ||
        (!cachedData || cacheAge >= 24 * 60 * 60 * 1000);

    console.log('shouldFetchFromAPI:', shouldFetchFromAPI);
    console.log('Reason:', date || dayof ? 'Có date hoặc dayof' : 'Logic khác');
};

// Test 3: Logic cache check
const testCacheCheck = () => {
    console.log('\n3️⃣ Test cache check logic:');

    const date = '03-08-2025';
    const dayof = 'thu-2';
    const cachedData = 'some cached data';
    const cacheAge = 1000 * 60 * 60; // 1 giờ

    // Logic mới: Không sử dụng cache khi có date hoặc dayof
    const shouldUseCache = cachedData && cacheAge < 24 * 60 * 60 * 1000 && !date && !dayof;

    console.log('Should use cache:', shouldUseCache);
    console.log('Reason:', date || dayof ? 'Có date hoặc dayof' : 'Cache valid');
};

// Test 4: API URL generation
const testAPIURL = () => {
    console.log('\n4️⃣ Test API URL generation:');

    const station = 'xsmb';
    const date = '03-08-2025';
    const dayof = 'thu-2';

    let url = 'https://backendkqxs-1.onrender.com/api/kqxs';

    if (dayof) {
        url = `${url}/xsmb/${dayof}`;
        console.log('URL for dayof:', url);
    } else if (station && date) {
        url = `${url}/xsmb?date=${date}`;
        console.log('URL for date:', url);
    } else {
        url = `${url}/xsmb`;
        console.log('URL for all:', url);
    }
};

// Chạy tất cả tests
testClearCache();
testShouldFetchFromAPI();
testCacheCheck();
testAPIURL();

console.log('\n🏁 Test hoàn thành!'); 