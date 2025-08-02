/**
 * Load Test Example for QA Engineers
 * This shows how to simulate multiple users testing an API
 */

const axios = require('axios');
const { createCollector, generateReport } = require('jmeter-style-reporter');

async function runLoadTest() {
    console.log('🚀 Starting API Load Test');
    console.log('=' .repeat(50));

    // Load test configuration
    const config = {
        baseURL: 'https://jsonplaceholder.typicode.com',
        virtualUsers: 5,        // Number of concurrent users
        testDuration: 30000,    // 30 seconds
        thinkTime: 1000,        // 1 second delay between requests
        endpoints: [
            { path: '/users', weight: 40 },      // 40% of requests
            { path: '/posts', weight: 30 },      // 30% of requests  
            { path: '/users/1', weight: 20 },    // 20% of requests
            { path: '/posts/1', weight: 10 }     // 10% of requests
        ]
    };

    console.log(`👥 Virtual Users: ${config.virtualUsers}`);
    console.log(`⏱️  Test Duration: ${config.testDuration / 1000}s`);
    console.log(`🎯 Target: ${config.baseURL}`);

    // Create performance collector
    const collector = createCollector({
        outputPath: './load-test-results.csv',
        testName: 'Load Test',
        bufferSize: 100,
        silent: true // Reduce noise during load test
    });

    console.log('\n🔄 Starting virtual users...\n');

    // Create promises for each virtual user
    const userPromises = [];
    for (let userId = 1; userId <= config.virtualUsers; userId++) {
        userPromises.push(simulateUser(userId, collector, config));
    }

    // Run all users concurrently and wait for completion
    const results = await Promise.all(userPromises);

    // Calculate totals
    const totalRequests = results.reduce((sum, result) => sum + result.requests, 0);
    const totalErrors = results.reduce((sum, result) => sum + result.errors, 0);

    console.log('\n📊 Flushing performance data...');
    await collector.flush();

    console.log('📈 Generating load test report...');
    const reportResult = await generateReport({
        csv: './load-test-results.csv',
        output: './load-test-report',
        title: 'API Load Test Report',
        theme: 'dark'
    });

    // Display results
    console.log('\n' + '=' .repeat(50));
    console.log('🎯 LOAD TEST RESULTS');
    console.log('=' .repeat(50));
    console.log(`👥 Virtual Users: ${config.virtualUsers}`);
    console.log(`📊 Total Requests: ${totalRequests}`);
    console.log(`❌ Total Errors: ${totalErrors}`);  
    console.log(`📈 Requests/User: ${(totalRequests / config.virtualUsers).toFixed(1)}`);
    console.log(`⚡ Requests/Second: ${(totalRequests / (config.testDuration / 1000)).toFixed(2)}`);
    console.log(`❌ Error Rate: ${((totalErrors / totalRequests) * 100).toFixed(2)}%`);

    console.log('\n📈 PERFORMANCE METRICS');
    console.log('=' .repeat(50));
    console.log(`⏱️  Average Response Time: ${reportResult.summary.averageResponseTime?.toFixed(2)}ms`);
    console.log(`📊 Total Requests: ${reportResult.summary.totalRequests}`);
    console.log(`🎯 Success Rate: ${((1 - reportResult.summary.errorRate) * 100).toFixed(2)}%`);

    console.log('\n🎯 REPORT GENERATED');
    console.log('=' .repeat(50));
    console.log(`📂 HTML Report: ${reportResult.reportUrl}`);
    console.log(`📋 Raw Data: ./load-test-results.csv`);

    if (process.platform === 'darwin') {
        console.log('\n💡 Quick open: open ./load-test-report/index.html');
    }

    console.log('\n🎉 Load Test Complete!');

    return {
        totalRequests,
        totalErrors,
        reportUrl: reportResult.reportUrl
    };
}

async function simulateUser(userId, collector, config) {
    const startTime = Date.now();
    let requests = 0;
    let errors = 0;

    console.log(`👤 User ${userId} started`);

    try {
        while (Date.now() - startTime < config.testDuration) {
            // Select random endpoint based on weights
            const endpoint = selectWeightedEndpoint(config.endpoints);
            const url = config.baseURL + endpoint.path;

            try {
                const requestStart = Date.now();
                const response = await axios.get(url, {
                    timeout: 5000 // 5 second timeout
                });
                const responseTime = Date.now() - requestStart;

                // Record successful request
                await collector.recordMetric({
                    endpoint: endpoint.path,
                    method: 'GET',
                    responseTime: responseTime,
                    statusCode: response.status,
                    success: true,
                    customFields: { userId: `user-${userId}` }
                });

                requests++;

            } catch (error) {
                const responseTime = Date.now() - requestStart;
                
                // Record failed request
                await collector.recordMetric({
                    endpoint: endpoint.path,
                    method: 'GET',
                    responseTime: responseTime,
                    statusCode: error.response?.status || 0,
                    success: false,
                    customFields: { userId: `user-${userId}` }
                });

                errors++;
            }

            // Think time - realistic delay between requests
            await new Promise(resolve => 
                setTimeout(resolve, config.thinkTime + Math.random() * 500)
            );
        }

    } catch (error) {
        console.error(`❌ User ${userId} encountered error:`, error.message);
    }

    console.log(`✅ User ${userId} completed: ${requests} requests, ${errors} errors`);
    
    return { requests, errors };
}

function selectWeightedEndpoint(endpoints) {
    const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of endpoints) {
        random -= endpoint.weight;
        if (random <= 0) {
            return endpoint;
        }
    }
    
    return endpoints[0]; // fallback
}

// Run if executed directly
if (require.main === module) {
    runLoadTest().catch(error => {
        console.error('\n💥 Load test failed:', error.message);
        process.exit(1);
    });
}

module.exports = runLoadTest;