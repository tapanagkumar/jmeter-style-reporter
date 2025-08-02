#!/usr/bin/env node

/**
 * Express.js Middleware Demo
 * 
 * Shows how to automatically collect performance data for all API calls
 * Run: node examples/express-middleware-demo.js
 * Then visit: http://localhost:3000/api/users
 */

const express = require('express')
const { createCollector, performanceMiddleware } = require('../dist/index.js')

const app = express()
const port = 3000

// Create performance collector
const collector = createCollector({ 
  outputPath: './examples/api-performance.csv',
  testName: 'Express API Demo'
})

// Add middleware to automatically collect performance data
app.use(performanceMiddleware(collector))

// Sample API routes
app.get('/api/users', async (req, res) => {
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))
  
  res.json({
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' }
    ]
  })
})

app.get('/api/products', async (req, res) => {
  // Simulate slower endpoint
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200))
  
  res.json({
    products: [
      { id: 1, name: 'Laptop', price: 999 },
      { id: 2, name: 'Phone', price: 599 }
    ]
  })
})

app.get('/api/orders', async (req, res) => {
  // Simulate occasional errors
  if (Math.random() < 0.2) {
    return res.status(500).json({ error: 'Internal server error' })
  }
  
  await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 150))
  
  res.json({
    orders: [
      { id: 1, userId: 1, total: 999, status: 'completed' },
      { id: 2, userId: 2, total: 599, status: 'pending' }
    ]
  })
})

// Health check endpoint (fast)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() })
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Express demo server running on http://localhost:${port}`)
  console.log('📊 Performance data will be collected automatically')
  console.log('')
  console.log('Try these endpoints:')
  console.log('  curl http://localhost:3000/api/users')
  console.log('  curl http://localhost:3000/api/products')
  console.log('  curl http://localhost:3000/api/orders')
  console.log('  curl http://localhost:3000/health')
  console.log('')
  console.log('📁 Data saved to: ./examples/api-performance.csv')
  console.log('📈 Generate report with: npx jmeter-style-reporter report examples/api-performance.csv --jenkins')
  console.log('📊 This generates: HTML report, Jenkins widget, JUnit XML, build comparison data')
})

// Graceful shutdown - flush data when server stops
process.on('SIGINT', async () => {
  console.log('\n📊 Flushing performance data...')
  await collector.flush()
  console.log('✅ Data saved successfully!')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await collector.flush()
  process.exit(0)
})