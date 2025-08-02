/**
 * Load Testing Script Example
 * 
 * This example demonstrates how to create a comprehensive load test
 * with automatic performance data collection and report generation.
 */

const { runTestWithReporting, createCollector } = require('jmeter-style-reporter')
const axios = require('axios')

// Configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  concurrentUsers: 10,
  testDuration: 60000, // 1 minute
  thinkTime: 1000, // 1 second between requests
  endpoints: [
    { path: '/api/users', method: 'GET', weight: 40 },
    { path: '/api/users/1', method: 'GET', weight: 30 },
    { path: '/api/users', method: 'POST', weight: 20, data: { name: 'Test User', email: 'test@example.com' } },
    { path: '/api/slow-endpoint', method: 'GET', weight: 10 }
  ]
}

/**
 * Simulates a single user's journey through the API
 */
async function simulateUser(userId, collector, config) {
  const client = axios.create({
    baseURL: config.baseUrl,
    timeout: 10000,
    headers: {
      'x-user-id': `user-${userId}`,
      'x-test-run': 'load-test'
    }
  })

  const startTime = Date.now()
  let requestCount = 0

  console.log(`👤 User ${userId} started`)

  while (Date.now() - startTime < config.testDuration) {
    try {
      // Select random endpoint based on weights
      const endpoint = selectWeightedEndpoint(config.endpoints)
      const requestStart = performance.now()

      let response
      if (endpoint.method === 'POST' && endpoint.data) {
        response = await client.post(endpoint.path, endpoint.data)
      } else {
        response = await client.get(endpoint.path)
      }

      const responseTime = performance.now() - requestStart

      // Record performance metric
      await collector.recordMetric({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        responseTime: responseTime,
        statusCode: response.status,
        method: endpoint.method,
        userId: `user-${userId}`,
        bytes: JSON.stringify(response.data).length,
        success: response.status >= 200 && response.status < 400
      })

      requestCount++

      // Think time between requests
      await new Promise(resolve => setTimeout(resolve, config.thinkTime + Math.random() * 500))

    } catch (error) {
      const responseTime = performance.now() - (error.config?.metadata?.startTime || performance.now())
      
      // Record error metric
      await collector.recordMetric({
        endpoint: `${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        responseTime: responseTime,
        statusCode: error.response?.status || 0,
        method: error.config?.method?.toUpperCase(),
        userId: `user-${userId}`,
        success: false,
        error: error.message
      })

      console.warn(`⚠️  User ${userId} encountered error:`, error.message)
    }
  }

  console.log(`✅ User ${userId} completed ${requestCount} requests`)
  return requestCount
}

/**
 * Selects an endpoint based on weighted distribution
 */
function selectWeightedEndpoint(endpoints) {
  const totalWeight = endpoints.reduce((sum, ep) => sum + ep.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const endpoint of endpoints) {
    random -= endpoint.weight
    if (random <= 0) {
      return endpoint
    }
  }
  
  return endpoints[0] // fallback
}

/**
 * Main load testing function
 */
async function runLoadTest() {
  console.log('🚀 Starting Load Test')
  console.log(`   Target: ${TEST_CONFIG.baseUrl}`)
  console.log(`   Users: ${TEST_CONFIG.concurrentUsers}`)
  console.log(`   Duration: ${TEST_CONFIG.testDuration / 1000}s`)
  console.log(`   Think Time: ${TEST_CONFIG.thinkTime}ms`)
  console.log()

  const result = await runTestWithReporting({
    testFunction: async (collector) => {
      // Start all virtual users concurrently
      const userPromises = []
      
      for (let userId = 1; userId <= TEST_CONFIG.concurrentUsers; userId++) {
        userPromises.push(simulateUser(userId, collector, TEST_CONFIG))
      }

      // Wait for all users to complete
      const requestCounts = await Promise.all(userPromises)
      const totalRequests = requestCounts.reduce((sum, count) => sum + count, 0)
      
      console.log(`\n📊 Load test completed!`)
      console.log(`   Total requests: ${totalRequests}`)
      console.log(`   Requests per user: ${(totalRequests / TEST_CONFIG.concurrentUsers).toFixed(1)}`)
      console.log(`   Requests per second: ${(totalRequests / (TEST_CONFIG.testDuration / 1000)).toFixed(2)}`)
    },
    collection: {
      outputPath: './load-test-results.csv',
      testName: 'API Load Test',
      bufferSize: 1000,
      flushInterval: 2000,
      onFlush: (count) => process.stdout.write(`📊 ${count} metrics recorded\r`)
    },
    reporting: {
      output: './load-test-report',
      title: 'API Load Test Results',
      theme: 'dark',
      percentiles: [50, 75, 90, 95, 99],
      maxDataPoints: 500
    },
    cleanup: false // Keep CSV for further analysis
  })

  console.log('\n📈 Load Test Results:')
  console.log(`   Report: ${result.reportPath}/index.html`)
  console.log(`   Total Requests: ${result.summary.totalRequests}`)
  console.log(`   Average Response Time: ${result.summary.averageResponseTime?.toFixed(2)}ms`)
  console.log(`   Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`)
  console.log(`   Throughput: ${result.summary.throughput.toFixed(2)} req/s`)
  console.log(`   Test Duration: ${(result.duration / 1000).toFixed(1)}s`)
  
  if (result.summary.errorRate > 0.05) {
    console.log('⚠️  High error rate detected! Check the report for details.')
  }
  
  if (result.summary.averageResponseTime > 1000) {
    console.log('⚠️  High response times detected! Performance may need optimization.')
  }

  return result
}

/**
 * Stress testing variant - gradually increase load
 */
async function runStressTest() {
  console.log('🔥 Starting Stress Test (Gradual Load Increase)')
  
  const phases = [
    { users: 5, duration: 30000, name: 'Warm-up' },
    { users: 10, duration: 60000, name: 'Normal Load' },
    { users: 20, duration: 60000, name: 'High Load' },
    { users: 50, duration: 30000, name: 'Stress Load' }
  ]

  const collector = createCollector({
    outputPath: './stress-test-results.csv',
    testName: 'API Stress Test',
    bufferSize: 2000,
    flushInterval: 1000
  })

  try {
    for (const phase of phases) {
      console.log(`\n📈 Phase: ${phase.name} (${phase.users} users, ${phase.duration / 1000}s)`)
      
      const phaseConfig = { ...TEST_CONFIG, concurrentUsers: phase.users, testDuration: phase.duration }
      const userPromises = []
      
      for (let userId = 1; userId <= phase.users; userId++) {
        userPromises.push(simulateUser(userId, collector, phaseConfig))
      }

      await Promise.all(userPromises)
      console.log(`✅ ${phase.name} phase completed`)
      
      // Brief pause between phases
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    await collector.flush()

    // Generate comprehensive stress test report
    const result = await generateReport({
      csv: './stress-test-results.csv',
      output: './stress-test-report',
      title: 'API Stress Test Results',
      theme: 'dark',
      percentiles: [50, 75, 90, 95, 99, 99.9],
      maxDataPoints: 1000
    })

    console.log('\n🔥 Stress Test Completed!')
    console.log(`   Report: ${result.reportPath}/index.html`)
    console.log(`   Peak Throughput: ${result.summary.throughput.toFixed(2)} req/s`)

  } finally {
    await collector.dispose()
  }
}

// CLI interface
if (require.main === module) {
  const testType = process.argv[2] || 'load'
  
  if (testType === 'stress') {
    runStressTest().catch(error => {
      console.error('❌ Stress test failed:', error)
      process.exit(1)
    })
  } else {
    runLoadTest().catch(error => {
      console.error('❌ Load test failed:', error)
      process.exit(1)
    })
  }
}

module.exports = {
  runLoadTest,
  runStressTest,
  simulateUser,
  TEST_CONFIG
}