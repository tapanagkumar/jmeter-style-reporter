#!/usr/bin/env node

/**
 * Manual Collection Demo
 * 
 * Shows how to manually collect performance data for testing scenarios
 * Run: node examples/manual-collection-demo.js
 */

const { createCollector } = require('../dist/index.js')

async function runDemo() {
  console.log('🚀 Manual Collection Demo')
  console.log('📊 Collecting performance data manually...')
  
  // Create collector
  const collector = createCollector({ 
    outputPath: './examples/manual-performance.csv',
    testName: 'Manual Collection Demo'
  })

  // Simulate API load test with manual measurements
  const endpoints = [
    { name: '/api/users', baseTime: 200 },
    { name: '/api/products', baseTime: 350 },
    { name: '/api/orders', baseTime: 450 },
    { name: '/api/analytics', baseTime: 1200 },
    { name: '/health', baseTime: 50 }
  ]

  console.log('\n📈 Simulating load test...')

  // Run 10 samples per endpoint
  for (let sample = 1; sample <= 10; sample++) {
    for (const endpoint of endpoints) {
      // Simulate API call with realistic variations
      const startTime = Date.now()
      
      // Add random variation (±30%)
      const variation = 1 + (Math.random() - 0.5) * 0.6
      const responseTime = Math.floor(endpoint.baseTime * variation)
      
      // Simulate occasional errors (5% chance)
      const success = Math.random() > 0.05
      const statusCode = success ? 200 : (Math.random() > 0.5 ? 404 : 500)
      
      // Record the metric
      await collector.recordMetric({
        endpoint: endpoint.name,
        method: 'GET',
        responseTime: responseTime,
        statusCode: statusCode,
        success: success,
        timestamp: startTime,
        bytes: Math.floor(Math.random() * 2000) + 500,
        sentBytes: Math.floor(Math.random() * 500) + 100
      })
      
      // Log progress
      const status = success ? '✅' : '❌'
      console.log(`  ${status} ${endpoint.name}: ${responseTime}ms (${statusCode})`)
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log(`📊 Completed sample ${sample}/10`)
  }

  // Flush data to CSV
  console.log('\n💾 Saving data to CSV...')
  await collector.flush()
  
  console.log('✅ Demo completed!')
  console.log('')
  console.log('📁 Data saved to: ./examples/manual-performance.csv')
  console.log('📈 Generate report with:')
  console.log('   npx jmeter-style-reporter report examples/manual-performance.csv --title "Manual Collection Demo" --jenkins')
  console.log('')
  console.log('📊 This will generate:')
  console.log('   • index.html - Interactive HTML report')
  console.log('   • jenkins-performance-badge.html - Jenkins dashboard widget')
  console.log('   • performance-results.xml - JUnit XML for Jenkins')
  console.log('   • .build-comparison.json - Build comparison data')
  console.log('   • allure-report/widgets/*.json - Performance summaries')
  console.log('')
  console.log('🎯 This simulated:')
  console.log('   • 50 total requests (10 per endpoint)')
  console.log('   • Realistic response time variations')
  console.log('   • 5% error rate across endpoints')
  console.log('   • Different performance profiles per endpoint')
}

// Run the demo
runDemo().catch(error => {
  console.error('❌ Demo failed:', error)
  process.exit(1)
})