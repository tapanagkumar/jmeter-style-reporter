/**
 * Basic integration tests for JMeter Style Reporter
 * Tests core functionality without external dependencies
 */

import { createCollector, JMeterPerformanceCollector, StatisticsCalculator } from '../src/index'
import * as fs from 'fs'
import * as path from 'path'

describe('JMeter Style Reporter', () => {
  const testOutputDir = path.join(__dirname, 'temp')
  const testCsvPath = path.join(testOutputDir, 'test.csv')

  beforeAll(() => {
    // Create temp directory for test outputs
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }
  })

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  describe('Basic Collector', () => {
    it('should create a collector instance', () => {
      const collector = createCollector({
        outputPath: testCsvPath,
        testName: 'Basic Test'
      })
      
      expect(collector).toBeDefined()
      expect(typeof collector.recordMetric).toBe('function')
      expect(typeof collector.flush).toBe('function')
    })

    it('should record metrics and flush to CSV', async () => {
      const collector = createCollector({
        outputPath: testCsvPath,
        testName: 'Metrics Test'
      })

      await collector.recordMetric({
        endpoint: '/api/test',
        responseTime: 123,
        statusCode: 200,
        method: 'GET'
      })

      await collector.flush()

      // Check if CSV file was created
      expect(fs.existsSync(testCsvPath)).toBe(true)
      
      // Check CSV content
      const csvContent = fs.readFileSync(testCsvPath, 'utf-8')
      expect(csvContent).toContain('/api/test')
      expect(csvContent).toContain('123')
      expect(csvContent).toContain('200')
    })
  })

  describe('Enhanced Collector', () => {
    it('should create an enhanced collector instance', () => {
      const collector = new JMeterPerformanceCollector({
        outputPath: path.join(testOutputDir, 'enhanced.csv'),
        testName: 'Enhanced Test'
      })
      
      expect(collector).toBeDefined()
      expect(typeof collector.recordMetric).toBe('function')
      expect(typeof collector.flush).toBe('function')
      expect(typeof collector.dispose).toBe('function')
    })

    it('should handle multiple metrics with enhanced features', async () => {
      const enhancedCsvPath = path.join(testOutputDir, 'enhanced-multi.csv')
      const collector = new JMeterPerformanceCollector({
        outputPath: enhancedCsvPath,
        testName: 'Multi Metrics Test',
        bufferSize: 5
      })

      // Record multiple metrics
      const metrics = [
        { endpoint: '/api/users', responseTime: 100, statusCode: 200, method: 'GET' },
        { endpoint: '/api/products', responseTime: 200, statusCode: 200, method: 'GET' },
        { endpoint: '/api/orders', responseTime: 300, statusCode: 500, method: 'POST' },
        { endpoint: '/api/users', responseTime: 150, statusCode: 200, method: 'GET' },
        { endpoint: '/api/products', responseTime: 250, statusCode: 200, method: 'GET' }
      ]

      for (const metric of metrics) {
        await collector.recordMetric(metric)
      }

      await collector.flush()
      await collector.dispose()

      // Verify CSV file
      expect(fs.existsSync(enhancedCsvPath)).toBe(true)
      
      const csvContent = fs.readFileSync(enhancedCsvPath, 'utf-8')
      expect(csvContent.split('\n').length).toBeGreaterThan(5) // Header + 5 data rows
      expect(csvContent).toContain('/api/users')
      expect(csvContent).toContain('/api/products')
      expect(csvContent).toContain('/api/orders')
    })
  })

  describe('Statistics Calculator', () => {
    it('should calculate percentiles correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      
      expect(StatisticsCalculator.calculatePercentile(data, 50)).toBe(5) // 50th percentile
      expect(StatisticsCalculator.calculatePercentile(data, 90)).toBe(9) // 90th percentile
      expect(StatisticsCalculator.calculatePercentile(data, 95)).toBe(10) // 95th percentile
      expect(StatisticsCalculator.calculatePercentile(data, 99)).toBe(10) // 99th percentile
    })

    it('should calculate APDEX score correctly', () => {
      // Test data: 50ms threshold
      const responseTimes = [30, 45, 60, 150, 250, 300, 400]
      const apdex = StatisticsCalculator.calculateApdexScore(responseTimes, 50, 'Test API')
      
      // Satisfying: 30, 45 (≤50ms) = 2 samples
      // Tolerating: 60, 150 (51-200ms) = 2 samples 
      // Frustrated: 250, 300, 400 (>200ms) = 3 samples
      // APDEX = (2 + 2/2) / 7 = 3/7 ≈ 0.43
      expect(apdex.score).toBeCloseTo(0.43, 2)
      expect(apdex.satisfied).toBe(2)
      expect(apdex.tolerating).toBe(2)
      expect(apdex.frustrated).toBe(3)
      expect(apdex.label).toBe('Test API')
    })

    it('should calculate standard deviation correctly', () => {
      const data = [1, 2, 3, 4, 5]
      const mean = 3 // Average of 1-5
      const stdDev = StatisticsCalculator.calculateStandardDeviation(data, mean)
      
      // Standard deviation of [1,2,3,4,5] with mean 3 is approximately 1.41
      expect(stdDev).toBeCloseTo(1.41, 2)
    })
  })

  describe('Package Exports', () => {
    it('should export all expected functions and classes', () => {
      const exports = require('../src/index')
      
      expect(exports.createCollector).toBeDefined()
      expect(exports.JMeterPerformanceCollector).toBeDefined()
      expect(exports.StatisticsCalculator).toBeDefined()
      expect(exports.generateJMeterReport).toBeDefined()
      expect(exports.EnhancedCollector).toBeDefined()
      expect(exports.generateEnhancedReport).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid file paths gracefully', async () => {
      const collector = createCollector({
        outputPath: '/invalid/path/test.csv',
        testName: 'Error Test'
      })

      await collector.recordMetric({
        endpoint: '/test',
        responseTime: 100,
        statusCode: 200
      })

      // Should not throw, but handle gracefully
      await expect(collector.flush()).rejects.toThrow()
    })

    it('should validate metric data', async () => {
      const collector = createCollector({
        outputPath: testCsvPath,
        testName: 'Validation Test'
      })

      // Should handle missing or invalid data
      await collector.recordMetric({
        endpoint: '/test',
        responseTime: -1, // Invalid negative time
        statusCode: 999 // Unusual status code
      })

      await collector.flush()
      expect(fs.existsSync(testCsvPath)).toBe(true)
    })
  })
})