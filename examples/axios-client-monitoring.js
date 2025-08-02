/**
 * Axios Client Performance Monitoring Example
 * 
 * This example demonstrates how to add performance monitoring
 * to HTTP client requests using Axios interceptors.
 */

const axios = require('axios')
const { createCollector, addPerformanceInterceptor, generateReport } = require('jmeter-style-reporter')

// Create performance collector
const collector = createCollector({
  outputPath: './http-client-performance.csv',
  testName: 'HTTP Client Monitoring',
  bufferSize: 300,
  flushInterval: 3000,
  onFlush: (count) => console.log(`📊 Recorded ${count} HTTP requests`),
  onError: (error) => console.error('❌ Performance collection error:', error)
})

// Create HTTP clients for different services
const apiClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
  headers: {
    'User-Agent': 'JMeter-Style-Reporter/1.0.0',
    'X-Client-ID': 'example-client'
  }
})

const localApiClient = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 3000,
  headers: {
    'X-Test-Client': 'axios-monitoring'
  }
})

// Add performance monitoring to both clients
addPerformanceInterceptor(collector, apiClient, {
  includeRequestData: true,
  includeResponseData: true,
  labelExtractor: (config) => `${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
  errorHandler: (error) => console.warn('Request monitoring error:', error.message)
})

addPerformanceInterceptor(collector, localApiClient, {
  includeRequestData: true,
  includeResponseData: true,
  labelExtractor: (config) => `${config.method?.toUpperCase()} ${config.url}`,
  customLabels: (config, response) => ({
    service: 'local-api',
    endpoint: config.url,
    cached: response?.headers['x-cache-hit'] === 'true'
  })
})

/**
 * Example function to demonstrate various HTTP operations
 */
async function demonstrateHttpOperations() {
  console.log('🚀 Starting HTTP operations demonstration...\n')

  try {
    // 1. Simple GET requests
    console.log('📥 Fetching posts...')
    const postsResponse = await apiClient.get('/posts?_limit=10')
    console.log(`✅ Fetched ${postsResponse.data.length} posts`)

    // 2. GET request with parameters
    console.log('📥 Fetching specific user...')
    const userResponse = await apiClient.get('/users/1')
    console.log(`✅ Fetched user: ${userResponse.data.name}`)

    // 3. POST request
    console.log('📤 Creating new post...')
    const newPost = {
      title: 'Performance Monitoring Example',
      body: 'This post was created while monitoring HTTP performance',
      userId: 1
    }
    const createResponse = await apiClient.post('/posts', newPost)
    console.log(`✅ Created post with ID: ${createResponse.data.id}`)

    // 4. PUT request
    console.log('📝 Updating post...')
    const updatedPost = {
      id: 1,
      title: 'Updated Performance Monitoring Example',
      body: 'This post was updated while monitoring performance',
      userId: 1
    }
    const updateResponse = await apiClient.put('/posts/1', updatedPost)
    console.log(`✅ Updated post ID: ${updateResponse.data.id}`)

    // 5. DELETE request
    console.log('🗑️ Deleting post...')
    await apiClient.delete('/posts/1')
    console.log('✅ Deleted post')

    // 6. Concurrent requests
    console.log('🔄 Making concurrent requests...')
    const concurrentPromises = [
      apiClient.get('/posts/1'),
      apiClient.get('/posts/2'),
      apiClient.get('/posts/3'),
      apiClient.get('/users/1'),
      apiClient.get('/users/2')
    ]
    const concurrentResults = await Promise.all(concurrentPromises)
    console.log(`✅ Completed ${concurrentResults.length} concurrent requests`)

    // 7. Local API requests (if available)
    console.log('🏠 Testing local API...')
    try {
      await localApiClient.get('/health')
      await localApiClient.get('/api/users')
      await localApiClient.post('/api/users', {
        name: 'HTTP Client Test User',
        email: 'test@httpmonitoring.com'
      })
      console.log('✅ Local API requests completed')
    } catch (error) {
      console.log('⚠️  Local API not available (start express-api-monitoring.js)')
    }

  } catch (error) {
    console.error('❌ HTTP operation failed:', error.message)
  }
}

/**
 * Stress test function to generate more data
 */
async function runHttpStressTest() {
  console.log('🔥 Starting HTTP stress test...\n')

  const operations = [
    () => apiClient.get('/posts'),
    () => apiClient.get('/users'),
    () => apiClient.get('/comments'),
    () => apiClient.get('/albums'),
    () => apiClient.get('/photos?_limit=5'),
    () => apiClient.post('/posts', { title: 'Stress Test', body: 'Test', userId: 1 }),
    () => apiClient.get('/posts/1')
  ]

  const iterations = 50
  const concurrency = 5

  for (let batch = 0; batch < iterations / concurrency; batch++) {
    const batchPromises = []
    
    for (let i = 0; i < concurrency; i++) {
      const operation = operations[Math.floor(Math.random() * operations.length)]
      batchPromises.push(
        operation().catch(error => {
          // Handle errors gracefully
          console.warn(`⚠️  Request failed: ${error.message}`)
        })
      )
    }

    await Promise.all(batchPromises)
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (batch % 2 === 0) {
      process.stdout.write(`📊 Progress: ${((batch + 1) * concurrency / iterations * 100).toFixed(0)}%\r`)
    }
  }

  console.log('\n✅ Stress test completed')
}

/**
 * Generate performance report
 */
async function generatePerformanceReport() {
  console.log('\n📊 Generating performance report...')
  
  try {
    // Ensure all metrics are flushed
    await collector.flush()
    
    const result = await generateReport({
      csv: './http-client-performance.csv',
      output: './http-client-reports',
      title: 'HTTP Client Performance Analysis',
      theme: 'auto',
      percentiles: [50, 75, 90, 95, 99],
      maxDataPoints: 1000
    })

    console.log('\n📈 Performance Report Generated!')
    console.log(`   📊 Report URL: ${result.reportUrl}`)
    console.log(`   📋 Total Requests: ${result.summary.totalRequests}`)
    console.log(`   ⏱️  Average Response Time: ${result.summary.averageResponseTime?.toFixed(2)}ms`)
    console.log(`   📈 Throughput: ${result.summary.throughput.toFixed(2)} req/s`)
    console.log(`   ❌ Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`)
    
    // Analysis and recommendations
    if (result.summary.averageResponseTime > 1000) {
      console.log('⚠️  High average response time detected!')
      console.log('💡 Consider optimizing slow endpoints or checking network connectivity')
    }
    
    if (result.summary.errorRate > 0.05) {
      console.log('⚠️  High error rate detected!')
      console.log('💡 Check error logs and endpoint availability')
    }
    
    console.log(`\n🎯 Performance Summary:`)
    console.log(`   Best performing endpoints: < 200ms response time`)
    console.log(`   Acceptable performance: 200-500ms response time`)
    console.log(`   Needs optimization: > 500ms response time`)

  } catch (error) {
    console.error('❌ Failed to generate report:', error)
  }
}

/**
 * Main execution function
 */
async function main() {
  const mode = process.argv[2] || 'demo'
  
  try {
    switch (mode) {
      case 'demo':
        await demonstrateHttpOperations()
        break
      case 'stress':
        await runHttpStressTest()
        break
      case 'full':
        await demonstrateHttpOperations()
        await runHttpStressTest()
        break
      default:
        console.log('Usage: node axios-client-monitoring.js [demo|stress|full]')
        return
    }

    await generatePerformanceReport()

  } catch (error) {
    console.error('❌ Application error:', error)
  } finally {
    // Cleanup
    await collector.dispose()
  }
}

/**
 * Real-time monitoring function
 */
function startRealtimeMonitoring() {
  let requestCount = 0
  let totalResponseTime = 0
  let errorCount = 0

  collector.on?.('metric', (metric) => {
    requestCount++
    totalResponseTime += metric.responseTime || 0
    if (!metric.success) errorCount++

    if (requestCount % 10 === 0) {
      const avgResponseTime = totalResponseTime / requestCount
      const errorRate = errorCount / requestCount
      
      console.log(`📊 Real-time Stats: ${requestCount} requests, ` +
                 `${avgResponseTime.toFixed(2)}ms avg, ` +
                 `${(errorRate * 100).toFixed(1)}% errors`)
    }
  })
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...')
  await collector.flush()
  await generatePerformanceReport()
  await collector.dispose()
  process.exit(0)
})

// Start real-time monitoring if available
startRealtimeMonitoring()

// Export for use in other modules
module.exports = {
  apiClient,
  localApiClient,
  collector,
  demonstrateHttpOperations,
  runHttpStressTest,
  generatePerformanceReport
}

// Run if called directly
if (require.main === module) {
  main()
}