#!/usr/bin/env node

/**
 * Jest Integration Demo
 * 
 * Shows how to integrate performance collection with Jest tests
 * Run: node examples/jest-integration-demo.js
 * 
 * For real Jest integration, add this to your test files:
 */

const { createCollector } = require('../dist/index.js')

// Mock Jest-like test structure
class MockJest {
  constructor() {
    this.tests = []
    this.collector = null
  }

  beforeAll(fn) {
    this.beforeAllFn = fn
  }

  afterAll(fn) {
    this.afterAllFn = fn
  }

  describe(name, fn) {
    console.log(`\n📝 ${name}`)
    fn()
  }

  test(name, fn) {
    this.tests.push({ name, fn })
  }

  async run() {
    if (this.beforeAllFn) await this.beforeAllFn()
    
    for (const test of this.tests) {
      console.log(`  ⚡ ${test.name}`)
      await test.fn()
    }
    
    if (this.afterAllFn) await this.afterAllFn()
  }
}

// Demo test suite
async function runJestDemo() {
  console.log('🚀 Jest Integration Demo')
  console.log('📊 Collecting performance data during tests...')

  const jest = new MockJest()
  let collector

  // Setup collector before tests
  jest.beforeAll(async () => {
    collector = createCollector({
      outputPath: './examples/jest-performance.csv',
      testName: 'Jest API Tests'
    })
    console.log('🔧 Performance collector initialized')
  })

  // Cleanup after tests
  jest.afterAll(async () => {
    await collector.flush()
    console.log('💾 Performance data saved')
  })

  // Test suite
  jest.describe('API Performance Tests', () => {
    
    jest.test('GET /api/users should respond quickly', async () => {
      const startTime = Date.now()
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 180))
      
      const responseTime = Date.now() - startTime
      
      // Record performance metric
      await collector.recordMetric({
        endpoint: 'GET /api/users',
        method: 'GET',
        responseTime: responseTime,
        statusCode: 200,
        success: true,
        testName: 'API Performance Tests'
      })
      
      console.log(`    ✅ Response time: ${responseTime}ms`)
    })

    jest.test('POST /api/orders should handle load', async () => {
      const startTime = Date.now()
      
      // Simulate slower POST operation
      await new Promise(resolve => setTimeout(resolve, 350))
      
      const responseTime = Date.now() - startTime
      
      await collector.recordMetric({
        endpoint: 'POST /api/orders',
        method: 'POST',
        responseTime: responseTime,
        statusCode: 201,
        success: true,
        testName: 'API Performance Tests'
      })
      
      console.log(`    ✅ Response time: ${responseTime}ms`)
    })

    jest.test('GET /api/analytics should not timeout', async () => {
      const startTime = Date.now()
      
      // Simulate analytics endpoint (slower)
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      const responseTime = Date.now() - startTime
      
      await collector.recordMetric({
        endpoint: 'GET /api/analytics',
        method: 'GET',
        responseTime: responseTime,
        statusCode: 200,
        success: true,
        testName: 'API Performance Tests'
      })
      
      console.log(`    ✅ Response time: ${responseTime}ms`)
    })

    jest.test('Error handling performance', async () => {
      const startTime = Date.now()
      
      // Simulate error scenario
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const responseTime = Date.now() - startTime
      
      await collector.recordMetric({
        endpoint: 'GET /api/invalid',
        method: 'GET',
        responseTime: responseTime,
        statusCode: 404,
        success: false,
        testName: 'API Performance Tests'
      })
      
      console.log(`    ❌ Error response time: ${responseTime}ms`)
    })
  })

  // Run the tests
  await jest.run()
  
  console.log('\n✅ Jest demo completed!')
  console.log('')
  console.log('📁 Data saved to: ./examples/jest-performance.csv')
  console.log('📈 Generate report with:')
  console.log('   npx jmeter-style-reporter report examples/jest-performance.csv --title "Jest API Tests" --jenkins')
  console.log('')
  console.log('📊 All output files: HTML report, Jenkins widget, JUnit XML, build comparison data')
  console.log('')
  console.log('🔧 To use in real Jest tests, add this to your test files:')
  console.log('')
  console.log('```javascript')
  console.log('const { createCollector } = require("jmeter-style-reporter")')
  console.log('')
  console.log('describe("API Tests", () => {')
  console.log('  let collector')
  console.log('')
  console.log('  beforeAll(() => {')
  console.log('    collector = createCollector({ outputPath: "./test-performance.csv" })')
  console.log('  })')
  console.log('')
  console.log('  afterAll(async () => {')
  console.log('    await collector.flush()')
  console.log('  })')
  console.log('')
  console.log('  test("API performance", async () => {')
  console.log('    const start = Date.now()')
  console.log('    const response = await fetch("/api/users")')
  console.log('    ')
  console.log('    await collector.recordMetric({')
  console.log('      endpoint: "/api/users",')
  console.log('      responseTime: Date.now() - start,')
  console.log('      statusCode: response.status')
  console.log('    })')
  console.log('  })')
  console.log('})')
  console.log('```')
}

// Run the demo
runJestDemo().catch(error => {
  console.error('❌ Jest demo failed:', error)
  process.exit(1)
})