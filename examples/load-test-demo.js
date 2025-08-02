#!/usr/bin/env node

/**
 * Load Test Demo
 * 
 * Shows how to simulate a realistic load test with concurrent users
 * Run: node examples/load-test-demo.js
 */

const { createCollector } = require('../dist/index.js')

async function simulateUser(userId, collector) {
  const endpoints = [
    { url: '/api/users', method: 'GET', weight: 40 },
    { url: '/api/products', method: 'GET', weight: 30 },
    { url: '/api/orders', method: 'GET', weight: 20 },
    { url: '/api/cart', method: 'POST', weight: 10 }
  ]

  // Each user makes 5-10 requests
  const requestCount = Math.floor(Math.random() * 6) + 5
  
  for (let i = 0; i < requestCount; i++) {
    // Select endpoint based on weight
    const rand = Math.random() * 100
    let endpoint
    let cumulative = 0
    
    for (const ep of endpoints) {
      cumulative += ep.weight
      if (rand <= cumulative) {
        endpoint = ep
        break
      }
    }

    // Simulate different response times per endpoint type
    let baseResponseTime
    switch (endpoint.url) {
      case '/api/users': baseResponseTime = 150; break
      case '/api/products': baseResponseTime = 280; break
      case '/api/orders': baseResponseTime = 420; break
      case '/api/cart': baseResponseTime = 350; break
      default: baseResponseTime = 200
    }

    // Add realistic variation and network latency
    const networkLatency = Math.random() * 50 + 10
    const serverTime = baseResponseTime * (0.7 + Math.random() * 0.6)
    const totalTime = Math.floor(serverTime + networkLatency)

    // Simulate success/error rates
    const errorRate = endpoint.method === 'POST' ? 0.08 : 0.05
    const success = Math.random() > errorRate
    
    let statusCode = 200
    if (!success) {
      const errorTypes = [400, 404, 500, 503]
      statusCode = errorTypes[Math.floor(Math.random() * errorTypes.length)]
    }

    // Record metric
    await collector.recordMetric({
      endpoint: `${endpoint.method} ${endpoint.url}`,
      method: endpoint.method,
      responseTime: totalTime,
      statusCode: statusCode,
      success: success,
      timestamp: Date.now(),
      bytes: Math.floor(Math.random() * 3000) + 200,
      sentBytes: endpoint.method === 'POST' ? Math.floor(Math.random() * 1000) + 200 : Math.floor(Math.random() * 200) + 50
    })

    // Random delay between requests (think time)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500))
  }

  console.log(`👤 User ${userId} completed ${requestCount} requests`)
}

async function runLoadTest() {
  console.log('🚀 Load Test Demo')
  console.log('📊 Simulating 25 concurrent users...')
  
  const collector = createCollector({ 
    outputPath: './examples/load-test-performance.csv',
    testName: 'Load Test Demo - 25 Users'
  })

  const startTime = Date.now()
  
  // Create 25 concurrent users
  const userPromises = []
  for (let userId = 1; userId <= 25; userId++) {
    userPromises.push(simulateUser(userId, collector))
  }

  // Wait for all users to complete
  await Promise.all(userPromises)
  
  const duration = (Date.now() - startTime) / 1000
  
  console.log('\n💾 Saving load test data...')
  await collector.flush()
  
  console.log('✅ Load test completed!')
  console.log(`⏱️  Total duration: ${duration.toFixed(1)} seconds`)
  console.log('')
  console.log('📁 Data saved to: ./examples/load-test-performance.csv')
  console.log('📈 Generate report with:')
  console.log('   npx jmeter-style-reporter report examples/load-test-performance.csv --title "Load Test - 25 Users" --jenkins')
  console.log('')
  console.log('📊 Generated files include:')
  console.log('   • Interactive HTML report with charts and drill-down')
  console.log('   • Jenkins dashboard widget for build page')
  console.log('   • JUnit XML for Jenkins test integration')
  console.log('   • Build comparison data for next run')
  console.log('')
  console.log('🎯 This simulated:')
  console.log('   • 25 concurrent users')
  console.log('   • Realistic user behavior patterns')
  console.log('   • Different endpoint usage weights')
  console.log('   • Variable response times and error rates')
  console.log('   • Think time between requests')
}

// Run the load test
runLoadTest().catch(error => {
  console.error('❌ Load test failed:', error)
  process.exit(1)
})