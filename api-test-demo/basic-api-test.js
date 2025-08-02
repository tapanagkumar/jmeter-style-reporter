/**
 * Basic API Test with Performance Monitoring
 * This demonstrates how a QA engineer would use jmeter-style-reporter
 */

const axios = require('axios');
const { createCollector, generateReport } = require('jmeter-style-reporter');

async function runBasicAPITest() {
    console.log('🧪 Starting Basic API Performance Test');
    console.log('=' .repeat(50));

    // Step 1: Create a performance collector
    const collector = createCollector({
        outputPath: './api-test-results.csv',
        testName: 'Basic API Test',
        bufferSize: 50, // Small buffer for demo
        silent: false // Show logging for demo
    });

    console.log('📊 Performance collector created');

    // Step 2: Test different APIs to show variety
    const testAPIs = [
        {
            name: 'JSONPlaceholder - Get Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            expectedStatus: 200,
            maxResponseTime: 2000
        },
        {
            name: 'JSONPlaceholder - Get Posts',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET',
            expectedStatus: 200,
            maxResponseTime: 2000
        },
        {
            name: 'JSONPlaceholder - Get User 1',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',  
            expectedStatus: 200,
            maxResponseTime: 1500
        },
        {
            name: 'JSONPlaceholder - Create Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            data: {
                title: 'Test Post',
                body: 'This is a test post for performance monitoring',
                userId: 1
            },
            expectedStatus: 201,
            maxResponseTime: 3000
        },
        {
            name: 'JSONPlaceholder - Invalid Endpoint (404 test)',
            url: 'https://jsonplaceholder.typicode.com/nonexistent',
            method: 'GET',
            expectedStatus: 404,
            maxResponseTime: 1000
        }
    ];

    let passedTests = 0;
    let failedTests = 0;

    console.log(`\n🔄 Running ${testAPIs.length} API tests...\n`);

    // Step 3: Execute tests and collect performance data
    for (let i = 0; i < testAPIs.length; i++) {
        const test = testAPIs[i];
        console.log(`Test ${i + 1}/${testAPIs.length}: ${test.name}`);

        try {
            const startTime = Date.now();
            
            let response;
            if (test.method === 'POST') {
                response = await axios.post(test.url, test.data);
            } else {
                response = await axios.get(test.url);
            }
            
            const responseTime = Date.now() - startTime;

            // Record performance metric
            await collector.recordMetric({
                endpoint: new URL(test.url).pathname,
                method: test.method,
                responseTime: responseTime,
                statusCode: response.status,
                success: response.status === test.expectedStatus,
                testName: test.name
            });

            // Test assertions
            const statusPassed = response.status === test.expectedStatus;
            const timePassed = responseTime <= test.maxResponseTime;
            const testPassed = statusPassed && timePassed;

            if (testPassed) {
                console.log(`  ✅ PASSED - ${response.status} (${responseTime}ms)`);
                passedTests++;
            } else {
                console.log(`  ❌ FAILED - ${response.status} (${responseTime}ms)`);
                if (!statusPassed) console.log(`     Expected status: ${test.expectedStatus}, got: ${response.status}`);
                if (!timePassed) console.log(`     Response time too slow: ${responseTime}ms > ${test.maxResponseTime}ms`);
                failedTests++;
            }

        } catch (error) {
            const responseTime = Date.now() - Date.now();
            console.log(`  ❌ ERROR - ${error.message}`);
            failedTests++;

            // Record error metric
            await collector.recordMetric({
                endpoint: new URL(test.url).pathname,
                method: test.method,
                responseTime: responseTime,
                statusCode: error.response?.status || 0,
                success: false,
                testName: test.name
            });
        }

        // Small delay between tests to make it realistic
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Step 4: Flush collected data
    console.log('\n📊 Saving performance data...');
    await collector.flush();

    // Step 5: Generate HTML report
    console.log('📈 Generating performance report...');
    
    const reportResult = await generateReport({
        csv: './api-test-results.csv',
        output: './performance-report',
        title: 'Basic API Performance Test Report',
        theme: 'light'
    });

    // Step 6: Show results
    console.log('\n' + '=' .repeat(50));
    console.log('🎯 TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log(`✅ Tests Passed: ${passedTests}`);
    console.log(`❌ Tests Failed: ${failedTests}`);
    console.log(`📊 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    
    console.log('\n📈 PERFORMANCE REPORT');
    console.log('=' .repeat(50));
    console.log(`📊 Total Requests: ${reportResult.summary.totalRequests}`);
    console.log(`⏱️  Average Response Time: ${reportResult.summary.averageResponseTime?.toFixed(2)}ms`);
    console.log(`❌ Error Rate: ${(reportResult.summary.errorRate * 100).toFixed(2)}%`);
    console.log(`📈 Throughput: ${reportResult.summary.throughput.toFixed(2)} req/s`);
    
    console.log('\n🎯 NEXT STEPS');
    console.log('=' .repeat(50));
    console.log(`📂 Open HTML Report: ${reportResult.reportUrl}`);
    console.log(`📋 Raw Data: ./api-test-results.csv`);
    console.log(`📊 Report Files: ./performance-report/`);
    
    if (process.platform === 'darwin') {
        console.log('\n💡 Quick open (macOS): open ./performance-report/index.html');
    } else if (process.platform === 'linux') {
        console.log('\n💡 Quick open (Linux): xdg-open ./performance-report/index.html');
    }

    console.log('\n🎉 API Performance Test Complete!');
    
    return {
        passed: passedTests,
        failed: failedTests,
        reportUrl: reportResult.reportUrl
    };
}

// Run the test if this file is executed directly
if (require.main === module) {
    runBasicAPITest().catch(error => {
        console.error('\n💥 Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = runBasicAPITest;