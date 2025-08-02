/**
 * Express.js API Performance Monitoring Example
 * 
 * This example demonstrates how to add performance monitoring
 * to an Express.js API with automatic report generation.
 */

const express = require('express')
const { createCollector, performanceMiddleware, generateReport } = require('../dist/index.js')

const app = express()
const port = 3000

// Create performance collector
const collector = createCollector({
  outputPath: './api-performance.csv',
  testName: 'Express API Monitoring',
  bufferSize: 500,
  flushInterval: 5000,
  onFlush: (count) => console.log(`📊 Flushed ${count} performance metrics`),
  onError: (error) => console.error('Performance collection error:', error)
})

// Add JSON parsing middleware
app.use(express.json())

// Add performance monitoring to all routes
app.use(performanceMiddleware(collector, {
  includeQuery: true,
  skipPaths: [/^\/health/, /^\/metrics/],
  customLabels: (req) => ({
    userId: req.headers['x-user-id'],
    apiVersion: req.headers['x-api-version'] || 'v1'
  })
}))

// Sample API routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

app.get('/api/users', async (req, res) => {
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200))
  
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]
  
  res.json({ users, total: users.length })
})

app.get('/api/users/:id', async (req, res) => {
  // Simulate database query with variable response time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 300))
  
  const userId = parseInt(req.params.id)
  
  if (userId > 100) {
    return res.status(404).json({ error: 'User not found' })
  }
  
  res.json({
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`
  })
})

app.post('/api/users', async (req, res) => {
  // Simulate user creation with processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500))
  
  const { name, email } = req.body
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' })
  }
  
  const newUser = {
    id: Math.floor(Math.random() * 1000) + 1,
    name,
    email,
    createdAt: new Date().toISOString()
  }
  
  res.status(201).json(newUser)
})

app.get('/api/slow-endpoint', async (req, res) => {
  // Simulate slow endpoint
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000))
  res.json({ message: 'This endpoint is intentionally slow' })
})

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 Express API server running at http://localhost:${port}`)
  console.log('📊 Performance monitoring enabled')
  console.log('\nTry these endpoints:')
  console.log(`  GET  http://localhost:${port}/api/users`)
  console.log(`  GET  http://localhost:${port}/api/users/1`)
  console.log(`  POST http://localhost:${port}/api/users`)
  console.log(`  GET  http://localhost:${port}/api/slow-endpoint`)
  console.log(`  GET  http://localhost:${port}/health`)
})

// Generate performance report on shutdown
async function gracefulShutdown(signal) {
  console.log(`\n📊 Received ${signal}, generating performance report...`)
  
  try {
    // Flush any remaining metrics
    await collector.flush()
    console.log('✅ Metrics flushed successfully')
    
    // Generate HTML report
    const result = await generateReport({
      csv: './api-performance.csv',
      output: './performance-reports',
      title: 'Express API Performance Report',
      theme: 'auto'
    })
    
    console.log(`📈 Performance report generated: ${result.reportUrl}`)
    console.log(`📊 Total requests processed: ${result.summary.totalRequests}`)
    console.log(`⏱️  Average response time: ${result.summary.averageResponseTime?.toFixed(2)}ms`)
    
  } catch (error) {
    console.error('❌ Error generating performance report:', error)
  } finally {
    await collector.dispose()
    server.close(() => {
      console.log('👋 Server shut down gracefully')
      process.exit(0)
    })
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Generate report every 5 minutes for long-running services
setInterval(async () => {
  try {
    await collector.flush()
    
    const result = await generateReport({
      csv: './api-performance.csv',
      output: './performance-reports',
      title: `Express API Performance - ${new Date().toISOString()}`,
      theme: 'auto'
    })
    
    console.log(`📈 Periodic report generated: ${result.summary.totalRequests} requests`)
  } catch (error) {
    console.error('Error generating periodic report:', error)
  }
}, 5 * 60 * 1000) // 5 minutes

module.exports = { app, collector }