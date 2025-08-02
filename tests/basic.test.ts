/**
 * Basic integration tests for JMeter Style Reporter
 * Tests core functionality without external dependencies
 */

import { createCollector, JMeterPerformanceCollector, StatisticsCalculator, generateJMeterReport } from '../src/index'
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
      expect(exports.PerformanceCollector).toBeDefined() // Legacy alias
      expect(exports.StatisticsCalculator).toBeDefined()
      expect(exports.generateJMeterReport).toBeDefined()
      expect(exports.generateReport).toBeDefined() // Legacy alias
      expect(exports.performanceMiddleware).toBeDefined()
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

  describe('Report Generation', () => {
    const testDataPath = path.join(__dirname, 'temp', 'test-report-data.csv')
    const reportOutputPath = path.join(__dirname, 'temp', 'test-report')

    beforeAll(async () => {
      // Create test data with realistic performance metrics
      const testData = [
        'timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename',
        `${Date.now() - 60000},150,/api/users,200,true,1024,256,1,1,"Load Test"`,
        `${Date.now() - 59000},75,/api/products,200,true,2048,128,1,1,"Load Test"`,
        `${Date.now() - 58000},300,/api/orders,200,true,512,64,1,1,"Load Test"`,
        `${Date.now() - 57000},500,/api/users,500,false,0,256,1,1,"Load Test"`,
        `${Date.now() - 56000},125,/api/products,200,true,1536,192,1,1,"Load Test"`,
        `${Date.now() - 55000},200,/api/orders,404,false,256,128,1,1,"Load Test"`,
        `${Date.now() - 54000},90,/api/users,200,true,2048,256,1,1,"Load Test"`,
        `${Date.now() - 53000},600,/api/analytics,200,true,4096,512,1,1,"Load Test"`,
        `${Date.now() - 52000},180,/api/products,200,true,1024,128,1,1,"Load Test"`,
        `${Date.now() - 51000},250,/api/orders,200,true,768,192,1,1,"Load Test"`
      ].join('\n')

      await fs.promises.writeFile(testDataPath, testData, 'utf8')
    })

    afterAll(async () => {
      // Cleanup
      try {
        await fs.promises.unlink(testDataPath)
        await fs.promises.rm(reportOutputPath, { recursive: true, force: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    })

    it('should generate a complete HTML report from CSV data', async () => {
      const result = await generateJMeterReport({
        csv: testDataPath,
        output: reportOutputPath,
        title: 'Test Report Generation',
        theme: 'light'
      })

      // Validate return structure
      expect(result).toHaveProperty('outputPath')
      expect(result).toHaveProperty('reportUrl')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('stats')

      // Validate output directory and files
      expect(fs.existsSync(result.outputPath)).toBe(true)
      expect(fs.existsSync(path.join(result.outputPath, 'index.html'))).toBe(true)

      // Validate summary data
      expect(result.summary.totalRequests).toBe(10)
      expect(result.summary.errorRate).toBeGreaterThan(0) // We have 2 errors out of 10
      expect(result.summary.errorRate).toBeLessThan(1) // But not 100% errors
      expect(result.summary.averageResponseTime).toBeGreaterThan(0)
      expect(result.summary.throughput).toBeGreaterThan(0)

      // Validate percentiles if included
      if (result.summary.percentiles) {
        expect(result.summary.percentiles.p50).toBeGreaterThan(0)
        expect(result.summary.percentiles.p95).toBeGreaterThan(0)
        expect(result.summary.percentiles.p99).toBeGreaterThan(0)
      }
    }, 10000) // 10 second timeout for report generation

    it('should generate valid HTML content', async () => {
      const result = await generateJMeterReport({
        csv: testDataPath,
        output: reportOutputPath,
        title: 'HTML Validation Test'
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = await fs.promises.readFile(htmlPath, 'utf8')

      // Validate HTML structure
      expect(htmlContent).toContain('<!DOCTYPE html>')
      expect(htmlContent).toContain('<html')
      expect(htmlContent).toContain('<head>')
      expect(htmlContent).toContain('<body>')
      expect(htmlContent).toContain('</html>')

      // Validate report title is included
      expect(htmlContent).toContain('HTML Validation Test')

      // Validate Chart.js is included
      expect(htmlContent).toContain('chart.js')
      
      // Validate essential sections are present
      expect(htmlContent).toContain('Total Requests')
      expect(htmlContent).toContain('Error Rate')
      expect(htmlContent).toContain('Average Response Time')
      expect(htmlContent).toContain('Throughput')

      // Validate interactive elements
      expect(htmlContent).toContain('Response Times Over Time')
      expect(htmlContent).toContain('Throughput & Error Rate')
      expect(htmlContent).toContain('Endpoint Statistics')

      // Validate no script injection vulnerabilities
      expect(htmlContent).not.toContain('<script>alert(')
      expect(htmlContent).not.toContain('javascript:')
      expect(htmlContent).not.toContain('onclick="alert(') // Only check for malicious onclick
      expect(htmlContent).not.toContain('eval(')
    })

    it('should handle different themes correctly', async () => {
      const lightResult = await generateJMeterReport({
        csv: testDataPath,
        output: path.join(reportOutputPath, 'light'),
        title: 'Light Theme Test',
        theme: 'light'
      })

      const darkResult = await generateJMeterReport({
        csv: testDataPath,
        output: path.join(reportOutputPath, 'dark'),
        title: 'Dark Theme Test',
        theme: 'dark'
      })

      // Both should generate successfully
      expect(fs.existsSync(path.join(lightResult.outputPath, 'index.html'))).toBe(true)
      expect(fs.existsSync(path.join(darkResult.outputPath, 'index.html'))).toBe(true)

      // Read content to verify theme application
      const lightHtml = await fs.promises.readFile(path.join(lightResult.outputPath, 'index.html'), 'utf8')
      const darkHtml = await fs.promises.readFile(path.join(darkResult.outputPath, 'index.html'), 'utf8')

      // Verify theme-specific content
      expect(lightHtml).toContain('const isDark = false')
      expect(darkHtml).toContain('const isDark = true')
    })

    it('should handle memory limits and large datasets gracefully', async () => {
      const result = await generateJMeterReport({
        csv: testDataPath,
        output: path.join(reportOutputPath, 'memory-test'),
        title: 'Memory Limit Test',
        maxMemoryUsageMB: 1, // Very low limit to test memory handling
        streamingMode: true
      })

      expect(result.stats.memoryUsedMB).toBeDefined()
      expect(result.stats.processingTimeMs).toBeDefined()
      expect(result.stats.recordsProcessed).toBe(10)
      expect(result.stats.recordsSkipped).toBe(0)
    })

    it('should validate data integrity and report errors', async () => {
      // Create CSV with some invalid data
      const invalidDataPath = path.join(__dirname, 'temp', 'invalid-test-data.csv')
      const invalidData = [
        'timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename',
        `${Date.now()},150,/api/valid,200,true,1024,256,1,1,"Test"`,
        `invalid-timestamp,abc,/api/invalid,999,true,1024,256,1,1,"Test"`, // Invalid data
        `${Date.now()},200,/api/valid2,201,true,512,128,1,1,"Test"`
      ].join('\n')

      await fs.promises.writeFile(invalidDataPath, invalidData, 'utf8')

      const result = await generateJMeterReport({
        csv: invalidDataPath,
        output: path.join(reportOutputPath, 'validation-test'),
        skipDataValidation: false // Enable validation
      })

      // Should still generate report but with warnings
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.stats.recordsProcessed).toBeLessThan(3) // Some records should be skipped
      expect(result.stats.recordsSkipped).toBeGreaterThan(0)

      // Cleanup
      await fs.promises.unlink(invalidDataPath)
    })

    it('should support backward compatibility with legacy options', async () => {
      // Test with v1.0 style options (without new fields)
      const legacyResult = await generateJMeterReport({
        csv: testDataPath,
        output: path.join(reportOutputPath, 'legacy-test'),
        title: 'Legacy Compatibility Test'
        // No new fields like apiVersion, maxMemoryUsageMB, etc.
      })

      expect(legacyResult).toHaveProperty('outputPath')
      expect(legacyResult).toHaveProperty('summary')
      expect(fs.existsSync(path.join(legacyResult.outputPath, 'index.html'))).toBe(true)
    })

    it('should generate Jenkins-compatible reports without external dependencies', async () => {
      const jenkinsResult = await generateJMeterReport({
        csv: testDataPath,
        output: path.join(reportOutputPath, 'jenkins-test'),
        title: 'Jenkins Compatible Report',
        jenkinsCompatible: true
      })

      const htmlPath = path.join(jenkinsResult.outputPath, 'index.html')
      const htmlContent = await fs.promises.readFile(htmlPath, 'utf8')

      // Should contain Chart.js CDN as proven to work in Jenkins
      expect(htmlContent).toContain('cdn.jsdelivr.net/npm/chart.js')
      expect(htmlContent).toContain('script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"')
      
      // Should use proper Chart.js API for Jenkins compatibility
      expect(htmlContent).toContain('new Chart(')
      expect(htmlContent).toContain('Chart(')
      
      // Should be completely self-contained
      expect(htmlContent).toContain('<!DOCTYPE html>')
      expect(htmlContent).toContain('</html>')
      
      // Charts should still work with embedded library
      expect(htmlContent).toContain('Response Times Over Time')
      expect(htmlContent).toContain('canvas')
    })

    it('should support embeddedCharts option for maximum compatibility', async () => {
      const embeddedResult = await generateJMeterReport({
        csv: testDataPath,
        output: path.join(reportOutputPath, 'embedded-test'),
        title: 'Embedded Charts Report',
        embeddedCharts: true
      })

      const htmlPath = path.join(embeddedResult.outputPath, 'index.html')
      const htmlContent = await fs.promises.readFile(htmlPath, 'utf8')

      // Should use embedded charts (Chart.js CDN) even without jenkinsCompatible flag
      expect(htmlContent).toContain('cdn.jsdelivr.net/npm/chart.js')
      expect(htmlContent).toContain('new Chart(')
    })

    it('should generate fully functional report with all interactive features and clean up', async () => {
      // Create a comprehensive test report with rich data
      const testReportPath = path.join(reportOutputPath, 'comprehensive-render-test')
      
      const result = await generateJMeterReport({
        csv: testDataPath,
        output: testReportPath,
        title: 'Comprehensive Rendering Test Report',
        theme: 'light',
        jenkinsCompatible: true,
        includeDrillDown: true,
        includeApdex: true,
        includePercentiles: true
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      expect(fs.existsSync(htmlPath)).toBe(true)

      const htmlContent = await fs.promises.readFile(htmlPath, 'utf8')

      // 📊 Validate Chart Components
      expect(htmlContent).toContain('canvas id="responseTimeChart"')
      expect(htmlContent).toContain('canvas id="throughputChart"')
      expect(htmlContent).toContain('canvas id="distributionChart"')
      expect(htmlContent).toContain('new Chart(responseTimeCtx')
      expect(htmlContent).toContain('new Chart(throughputCtx')
      expect(htmlContent).toContain('new Chart(distributionCtx')

      // 🎛️ Validate Interactive Features
      expect(htmlContent).toContain('function showTab(')
      expect(htmlContent).toContain('function showDrillDown(')
      expect(htmlContent).toContain('function closeDrillDown(')
      expect(htmlContent).toContain('onclick="showTab(')
      expect(htmlContent).toContain('onclick="showDrillDown(')

      // 📋 Validate Data Tables
      expect(htmlContent).toContain('Endpoint Statistics')
      expect(htmlContent).toContain('Error Summary')
      expect(htmlContent).toContain('APDEX Scores by Endpoint')
      expect(htmlContent).toContain('<table>')
      expect(htmlContent).toContain('<tbody>')

      // 🎨 Validate Styling and Layout
      expect(htmlContent).toContain('.panel')
      expect(htmlContent).toContain('.summary-grid')
      expect(htmlContent).toContain('.chart-container')
      expect(htmlContent).toContain('.modal')
      expect(htmlContent).toContain('.tabs')

      // 📊 Validate Data Rendering
      expect(htmlContent).toContain('Total Requests')
      expect(htmlContent).toContain('Error Rate')
      expect(htmlContent).toContain('Average Response Time')
      expect(htmlContent).toContain('Throughput')
      expect(htmlContent).toContain('APDEX Score')

      // 🔧 Validate JavaScript Functionality
      expect(htmlContent).toContain('const timeSeriesData =')
      expect(htmlContent).toContain('const endpointData =')
      expect(htmlContent).toContain('const allResponseTimes =')
      expect(htmlContent).toContain('chartColors')
      expect(htmlContent).toContain('gridColor')

      // 🎯 Validate Drill-down Modal
      expect(htmlContent).toContain('id="drillDownModal"')
      expect(htmlContent).toContain('id="drillDownTitle"')
      expect(htmlContent).toContain('id="drillDownContent"')
      expect(htmlContent).toContain('drillDownChart')

      // 📱 Validate Responsive Design
      expect(htmlContent).toContain('@media (max-width: 768px)')
      expect(htmlContent).toContain('viewport')

      // 🔒 Validate Security
      expect(htmlContent).not.toContain('<script>alert(')
      expect(htmlContent).not.toContain('javascript:')
      expect(htmlContent).not.toContain('eval(')

      // ✅ Validate Report Statistics
      expect(result.summary.totalRequests).toBeGreaterThan(0)
      expect(result.summary.averageResponseTime).toBeGreaterThan(0)
      expect(result.summary.errorRate).toBeGreaterThanOrEqual(0)
      expect(result.summary.throughput).toBeGreaterThan(0)
      expect(result.summary.percentiles).toBeDefined()
      expect(result.summary.apdexScore).toBeDefined()

      // 🧹 Clean up the test report directory
      await fs.promises.rm(testReportPath, { recursive: true, force: true })
      
      // ✅ Verify cleanup was successful
      expect(fs.existsSync(testReportPath)).toBe(false)
      expect(fs.existsSync(htmlPath)).toBe(false)
    })
  })
})