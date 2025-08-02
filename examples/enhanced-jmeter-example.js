/**
 * Enhanced JMeter Reporter Example
 * Demonstrates the new features including percentiles, APDEX scores, and drill-down
 */

const { 
  EnhancedCollector, 
  generateEnhancedReport,
  createCollector 
} = require('../dist/index.js')

async function runEnhancedExample() {
  console.log('🚀 Enhanced JMeter Reporter Example')
  console.log('=====================================\n')

  // Create enhanced collector with JMeter compatibility
  const collector = new EnhancedCollector({
    outputPath: './enhanced-performance.csv',
    testName: 'Enhanced Performance Test',
    bufferSize: 100,
    flushInterval: 2000,
    jmeterCompatible: true,
    onFlush: (count) => console.log(`📊 Flushed ${count} metrics`),
    onError: (error) => console.error('❌ Error:', error)
  })

  console.log('📈 Simulating API traffic with various response times...\n')

  // Simulate various API endpoints with different performance characteristics
  const endpoints = [
    { path: '/api/users', baseTime: 50, variance: 30, errorRate: 0.02 },
    { path: '/api/products', baseTime: 100, variance: 50, errorRate: 0.05 },
    { path: '/api/search', baseTime: 200, variance: 100, errorRate: 0.08 },
    { path: '/api/checkout', baseTime: 500, variance: 200, errorRate: 0.03 },
    { path: '/api/analytics', baseTime: 1000, variance: 500, errorRate: 0.1 }
  ]

  // Simulate 1000 requests over 30 seconds
  const testDuration = 30000 // 30 seconds
  const totalRequests = 1000
  const startTime = Date.now()

  for (let i = 0; i < totalRequests; i++) {
    // Select random endpoint
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
    
    // Calculate response time with variance
    const responseTime = Math.max(
      10,
      endpoint.baseTime + (Math.random() - 0.5) * 2 * endpoint.variance
    )
    
    // Determine if request should fail
    const shouldFail = Math.random() < endpoint.errorRate
    const statusCode = shouldFail ? 
      [400, 404, 500, 503][Math.floor(Math.random() * 4)] : 200
    
    // Record metric
    await collector.recordMetric({
      endpoint: endpoint.path,
      responseTime: responseTime,
      statusCode: statusCode,
      method: 'GET',
      timestamp: startTime + (i * testDuration / totalRequests),
      success: !shouldFail,
      bytes: Math.floor(Math.random() * 10000) + 1000,
      sentBytes: Math.floor(Math.random() * 1000) + 100,
      grpThreads: Math.min(10, Math.floor(i / 100) + 1),
      allThreads: Math.min(10, Math.floor(i / 100) + 1)
    })
    
    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`Progress: ${i + 1}/${totalRequests} requests`)
    }
  }

  // Flush remaining metrics
  await collector.dispose()
  console.log('\n✅ Test data generation complete!\n')

  // Generate enhanced report with all features
  console.log('📊 Generating enhanced JMeter report...\n')
  
  try {
    const result = await generateEnhancedReport({
      csv: './enhanced-performance.csv',
      output: './enhanced-jmeter-report',
      title: 'Enhanced Performance Test Report',
      theme: 'light',
      includePercentiles: true,
      includeApdex: true,
      apdexThreshold: 500,
      includeDrillDown: true
    })

    console.log('📈 Enhanced Report Generated Successfully!')
    console.log('==========================================')
    console.log(`📁 Output Directory: ${result.outputPath}`)
    console.log(`🌐 Report URL: ${result.reportUrl}`)
    console.log('\n📊 Summary Statistics:')
    console.log(`  • Total Requests: ${result.summary.totalRequests}`)
    console.log(`  • Average Response Time: ${result.summary.averageResponseTime?.toFixed(2)}ms`)
    console.log(`  • Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`)
    console.log(`  • Throughput: ${result.summary.throughput.toFixed(2)} req/s`)
    
    if (result.summary.percentiles) {
      console.log('\n📊 Response Time Percentiles:')
      console.log(`  • 50th percentile (Median): ${result.summary.percentiles.p50.toFixed(0)}ms`)
      console.log(`  • 90th percentile: ${result.summary.percentiles.p90.toFixed(0)}ms`)
      console.log(`  • 95th percentile: ${result.summary.percentiles.p95.toFixed(0)}ms`)
      console.log(`  • 99th percentile: ${result.summary.percentiles.p99.toFixed(0)}ms`)
    }
    
    if (result.summary.apdexScore !== undefined) {
      console.log(`\n🎯 APDEX Score: ${result.summary.apdexScore.toFixed(3)}`)
      console.log(`  (Threshold: 500ms)`)
      
      const rating = result.summary.apdexScore >= 0.94 ? 'Excellent' :
                     result.summary.apdexScore >= 0.85 ? 'Good' :
                     result.summary.apdexScore >= 0.70 ? 'Fair' : 'Poor'
      console.log(`  Rating: ${rating}`)
    }
    
    console.log('\n✨ Report Features:')
    console.log('  • Interactive charts with Chart.js')
    console.log('  • Response time distribution histogram')
    console.log('  • Time series analysis')
    console.log('  • Endpoint-level drill-down capability')
    console.log('  • APDEX scores by endpoint')
    console.log('  • Error breakdown analysis')
    
    console.log('\n🎉 Open the report in your browser to explore the results!')
    
  } catch (error) {
    console.error('❌ Error generating report:', error)
  }
}

// Run the example
runEnhancedExample().catch(console.error)