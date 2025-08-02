/**
 * Jest Performance Testing Example
 * 
 * This example shows how to integrate performance testing
 * into your Jest test suite with automatic reporting.
 */

const { createCollector, withPerformanceTracking, generateReport } = require('jmeter-style-reporter')
const axios = require('axios')

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const PERFORMANCE_THRESHOLD_MS = 500
const MAX_ERROR_RATE = 0.05

describe('API Performance Tests', () => {
  let collector
  let client

  beforeAll(async () => {
    // Create performance collector for all tests
    collector = createCollector({
      outputPath: './jest-performance-results.csv',
      testName: 'Jest Performance Tests',
      bufferSize: 200,
      flushInterval: 1000,
      silent: true // Quiet mode for test runs
    })

    // Create HTTP client
    client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 5000,
      headers: {
        'x-test-suite': 'jest-performance'
      }
    })
  })

  afterAll(async () => {
    try {
      // Flush remaining metrics
      await collector.flush()
      
      // Generate performance report
      const result = await generateReport({
        csv: './jest-performance-results.csv',
        output: './jest-performance-reports',
        title: 'Jest Performance Test Results',
        theme: 'light'
      })

      console.log(`\n📊 Performance Report Generated: ${result.reportUrl}`)
      console.log(`📈 Total Requests: ${result.summary.totalRequests}`)
      console.log(`⏱️  Average Response Time: ${result.summary.averageResponseTime?.toFixed(2)}ms`)
      console.log(`❌ Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`)

      // Performance assertions for the entire test suite
      expect(result.summary.averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS)
      expect(result.summary.errorRate).toBeLessThan(MAX_ERROR_RATE)

    } finally {
      await collector.dispose()
    }
  })

  describe('Individual Endpoint Performance', () => {
    test('GET /api/users should respond quickly', withPerformanceTracking(
      async (perfCollector) => {
        const responses = []
        const iterations = 10

        for (let i = 0; i < iterations; i++) {
          const start = performance.now()
          const response = await client.get('/api/users')
          const duration = performance.now() - start

          await perfCollector.recordMetric({
            endpoint: 'GET /api/users',
            responseTime: duration,
            statusCode: response.status,
            method: 'GET',
            testName: 'Individual Endpoint Performance'
          })

          responses.push({ response, duration })
        }

        // Individual test assertions
        responses.forEach(({ response, duration }) => {
          expect(response.status).toBe(200)
          expect(duration).toBeLessThan(300) // Stricter threshold for this endpoint
          expect(response.data).toHaveProperty('users')
          expect(Array.isArray(response.data.users)).toBe(true)
        })

        // Aggregate performance assertions
        const avgDuration = responses.reduce((sum, r) => sum + r.duration, 0) / responses.length
        const maxDuration = Math.max(...responses.map(r => r.duration))
        
        expect(avgDuration).toBeLessThan(200)
        expect(maxDuration).toBeLessThan(500)

        console.log(`✅ /api/users - Avg: ${avgDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`)
      }
    ))

    test('GET /api/users/:id should handle various IDs efficiently', withPerformanceTracking(
      async (perfCollector) => {
        const userIds = [1, 2, 3, 5, 10, 25, 50, 99, 404] // Include a 404 case
        const results = []

        for (const userId of userIds) {
          const start = performance.now()
          
          try {
            const response = await client.get(`/api/users/${userId}`)
            const duration = performance.now() - start

            await perfCollector.recordMetric({
              endpoint: 'GET /api/users/{id}',
              responseTime: duration,
              statusCode: response.status,
              method: 'GET',
              customFields: { userId: userId.toString() }
            })

            results.push({ userId, response, duration, success: true })

          } catch (error) {
            const duration = performance.now() - start

            await perfCollector.recordMetric({
              endpoint: 'GET /api/users/{id}',
              responseTime: duration,
              statusCode: error.response?.status || 0,
              method: 'GET',
              success: false,
              customFields: { userId: userId.toString() }
            })

            results.push({ userId, error, duration, success: false })
          }
        }

        // Validate successful responses
        const successfulResults = results.filter(r => r.success)
        successfulResults.forEach(result => {
          expect(result.response.status).toBe(200)
          expect(result.response.data).toHaveProperty('id')
          expect(result.duration).toBeLessThan(400)
        })

        // Validate error responses
        const errorResults = results.filter(r => !r.success)
        errorResults.forEach(result => {
          expect(result.error.response?.status).toBe(404)
          expect(result.duration).toBeLessThan(200) // Errors should be fast
        })

        const avgSuccessfulDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length
        console.log(`✅ /api/users/:id - Successful avg: ${avgSuccessfulDuration.toFixed(2)}ms`)
      }
    ))

    test('POST /api/users should create users within time limits', withPerformanceTracking(
      async (perfCollector) => {
        const testUsers = [
          { name: 'Alice Johnson', email: 'alice@test.com' },
          { name: 'Bob Smith', email: 'bob@test.com' },
          { name: 'Carol Brown', email: 'carol@test.com' }
        ]

        const results = []

        for (const userData of testUsers) {
          const start = performance.now()
          const response = await client.post('/api/users', userData)
          const duration = performance.now() - start

          await perfCollector.recordMetric({
            endpoint: 'POST /api/users',
            responseTime: duration,
            statusCode: response.status,
            method: 'POST',
            bytes: JSON.stringify(response.data).length,
            sentBytes: JSON.stringify(userData).length
          })

          results.push({ userData, response, duration })
        }

        // Validate all creations
        results.forEach(({ userData, response, duration }) => {
          expect(response.status).toBe(201)
          expect(response.data).toHaveProperty('id')
          expect(response.data.name).toBe(userData.name)
          expect(response.data.email).toBe(userData.email)
          expect(duration).toBeLessThan(600) // POST operations can be slower
        })

        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
        console.log(`✅ POST /api/users - Avg: ${avgDuration.toFixed(2)}ms`)
      }
    ))
  })

  describe('Load Testing Scenarios', () => {
    test('concurrent user simulation', withPerformanceTracking(
      async (perfCollector) => {
        const concurrentUsers = 5
        const requestsPerUser = 3

        // Simulate concurrent users
        const userPromises = Array.from({ length: concurrentUsers }, async (_, userId) => {
          const userResults = []

          for (let req = 0; req < requestsPerUser; req++) {
            const start = performance.now()
            const response = await client.get('/api/users')
            const duration = performance.now() - start

            await perfCollector.recordMetric({
              endpoint: 'GET /api/users',
              responseTime: duration,
              statusCode: response.status,
              method: 'GET',
              customFields: { 
                userId: `concurrent-user-${userId}`,
                requestNumber: req.toString()
              }
            })

            userResults.push(duration)
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          return userResults
        })

        const allResults = await Promise.all(userPromises)
        const flatResults = allResults.flat()

        // Performance assertions for concurrent load
        const avgDuration = flatResults.reduce((sum, d) => sum + d, 0) / flatResults.length
        const maxDuration = Math.max(...flatResults)
        const minDuration = Math.min(...flatResults)

        expect(avgDuration).toBeLessThan(400)
        expect(maxDuration).toBeLessThan(1000)
        expect(flatResults.length).toBe(concurrentUsers * requestsPerUser)

        console.log(`✅ Concurrent Load - Avg: ${avgDuration.toFixed(2)}ms, Min: ${minDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms`)
      }
    ))

    test('error handling performance', withPerformanceTracking(
      async (perfCollector) => {
        // Test various error scenarios
        const errorScenarios = [
          { endpoint: '/api/users/999999', expectedStatus: 404 },
          { endpoint: '/api/nonexistent', expectedStatus: 404 },
          { endpoint: '/api/users', method: 'POST', data: {}, expectedStatus: 400 } // Invalid data
        ]

        for (const scenario of errorScenarios) {
          const start = performance.now()
          
          try {
            if (scenario.method === 'POST') {
              await client.post(scenario.endpoint, scenario.data)
            } else {
              await client.get(scenario.endpoint)
            }
          } catch (error) {
            const duration = performance.now() - start

            await perfCollector.recordMetric({
              endpoint: `${scenario.method || 'GET'} ${scenario.endpoint}`,
              responseTime: duration,
              statusCode: error.response?.status || 0,
              method: scenario.method || 'GET',
              success: false
            })

            // Error responses should be fast
            expect(duration).toBeLessThan(200)
            expect(error.response?.status).toBe(scenario.expectedStatus)
          }
        }

        console.log('✅ Error scenarios handled efficiently')
      }
    ))
  })

  describe('Performance Regression Tests', () => {
    test('baseline performance benchmarks', withPerformanceTracking(
      async (perfCollector) => {
        // Define performance baselines
        const benchmarks = [
          { endpoint: '/api/users', method: 'GET', maxTime: 200, iterations: 5 },
          { endpoint: '/api/users/1', method: 'GET', maxTime: 250, iterations: 3 }
        ]

        for (const benchmark of benchmarks) {
          const durations = []

          for (let i = 0; i < benchmark.iterations; i++) {
            const start = performance.now()
            const response = await client.get(benchmark.endpoint)
            const duration = performance.now() - start

            await perfCollector.recordMetric({
              endpoint: `${benchmark.method} ${benchmark.endpoint}`,
              responseTime: duration,
              statusCode: response.status,
              method: benchmark.method,
              testName: 'Performance Regression Tests'
            })

            durations.push(duration)
            
            // Small delay between benchmark runs
            await new Promise(resolve => setTimeout(resolve, 50))
          }

          const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
          const maxDuration = Math.max(...durations)

          // Assert against baseline
          expect(avgDuration).toBeLessThan(benchmark.maxTime)
          expect(maxDuration).toBeLessThan(benchmark.maxTime * 1.5)

          console.log(`📊 ${benchmark.endpoint} - Avg: ${avgDuration.toFixed(2)}ms (baseline: ${benchmark.maxTime}ms)`)
        }
      }
    ))
  })

  // Helper method to check if API is available
  beforeEach(async () => {
    try {
      await client.get('/health')
    } catch (error) {
      console.warn(`⚠️  API at ${API_BASE_URL} might not be available:`, error.message)
      console.log('💡 Start the Express server with: node examples/express-api-monitoring.js')
    }
  })
})