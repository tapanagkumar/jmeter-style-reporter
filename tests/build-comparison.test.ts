/**
 * Build Comparison Tests for JMeter Style Reporter
 * Tests the new build-to-build performance comparison functionality
 */

import { generateJMeterReport } from '../src/index'
import * as fs from 'fs'
import * as path from 'path'

describe('Build Comparison Features', () => {
  const testOutputDir = path.join(__dirname, 'temp-comparison')
  const testCsvPath = path.join(testOutputDir, 'test-data.csv')
  const previousBuildPath = path.join(testOutputDir, '.build-comparison.json')
  const reportOutputPath = path.join(testOutputDir, 'comparison-report')

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

  beforeEach(async () => {
    // Create realistic test data
    const testData = [
      'timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename',
      `${Date.now() - 60000},250,GET /api/users,200,true,1024,256,1,1,"API Test"`,
      `${Date.now() - 59000},148,GET /api/products,200,true,2048,128,1,1,"API Test"`, // Will be ~149ms avg, stable vs 150ms
      `${Date.now() - 58000},420,POST /api/orders,200,true,512,64,1,1,"API Test"`,
      `${Date.now() - 57000},150,GET /api/users,200,true,1024,256,1,1,"API Test"`,
      `${Date.now() - 56000},150,GET /api/products,200,true,2048,128,1,1,"API Test"`, // Average will be ~149ms vs 150ms (stable)
      `${Date.now() - 55000},380,POST /api/orders,200,true,512,64,1,1,"API Test"`,
      `${Date.now() - 54000},320,PUT /api/profile,200,true,768,192,1,1,"API Test"`,
      `${Date.now() - 53000},95,DELETE /api/cache,200,true,256,128,1,1,"API Test"`,
      `${Date.now() - 52000},1250,GET /api/analytics,200,true,4096,512,1,1,"API Test"`,
      `${Date.now() - 51000},180,GET /api/users,200,true,1024,256,1,1,"API Test"`
    ].join('\n')

    await fs.promises.writeFile(testCsvPath, testData, 'utf8')
  })

  describe('First Build (Baseline)', () => {
    it('should generate initial build without comparison data', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'First Build - Baseline',
        compareToPrevious: true
      })

      expect(result).toBeDefined()
      expect(result.outputPath).toBe(reportOutputPath)
      expect(fs.existsSync(path.join(reportOutputPath, 'index.html'))).toBe(true)

      // Should generate build comparison file for next build
      const buildComparisonPath = path.join(reportOutputPath, '.build-comparison.json')
      expect(fs.existsSync(buildComparisonPath)).toBe(true)

      const comparisonData = JSON.parse(fs.readFileSync(buildComparisonPath, 'utf8'))
      expect(comparisonData).toHaveProperty('buildNumber')
      expect(comparisonData).toHaveProperty('timestamp')
      expect(comparisonData).toHaveProperty('endpoints')
      expect(typeof comparisonData.endpoints).toBe('object')
      expect(Object.keys(comparisonData.endpoints).length).toBeGreaterThan(0)

      // Validate endpoint structure
      const firstEndpointKey = Object.keys(comparisonData.endpoints)[0]
      const firstEndpoint = comparisonData.endpoints[firstEndpointKey]
      expect(firstEndpoint).toHaveProperty('average')
      expect(firstEndpoint).toHaveProperty('samples')
      expect(firstEndpoint).toHaveProperty('errorRate')
      expect(firstEndpoint).toHaveProperty('throughput')
    })

    it('should generate report with no trend indicators for first build', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'First Build Report',
        compareToPrevious: false // Explicitly disable comparison
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // Should not contain trend indicators when comparison is disabled
      expect(htmlContent).not.toContain('trend-indicator')
      expect(htmlContent).not.toContain('↓')
      expect(htmlContent).not.toContain('↑')
      expect(htmlContent).not.toContain('→')
    })
  })

  describe('Second Build (With Comparison)', () => {
    beforeEach(async () => {
      // Create previous build data (simulating a previous build)
      const previousBuildData = {
        buildNumber: 126,
        timestamp: Date.now() - 86400000, // 24 hours ago
        endpoints: {
          'GET /api/users': { average: 275, samples: 3, errorRate: 0, throughput: 1.2 }, // Was slower
          'GET /api/products': { average: 150, samples: 2, errorRate: 0, throughput: 1.5 }, // Similar performance
          'POST /api/orders': { average: 300, samples: 2, errorRate: 0, throughput: 0.8 }, // Was faster
          'PUT /api/profile': { average: 420, samples: 1, errorRate: 0, throughput: 0.3 }, // Was much slower
          'DELETE /api/cache': { average: 145, samples: 1, errorRate: 0, throughput: 2.0 }, // Was slower
          'GET /api/analytics': { average: 1050, samples: 1, errorRate: 0, throughput: 0.5 } // Was faster
        }
      }

      await fs.promises.writeFile(previousBuildPath, JSON.stringify(previousBuildData, null, 2), 'utf8')
    })

    it('should generate report with build comparison data', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Second Build - With Comparison',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      expect(result).toBeDefined()
      expect(fs.existsSync(path.join(reportOutputPath, 'index.html'))).toBe(true)

      // Should generate updated build comparison file
      const newBuildComparisonPath = path.join(reportOutputPath, '.build-comparison.json')
      expect(fs.existsSync(newBuildComparisonPath)).toBe(true)

      const newComparisonData = JSON.parse(fs.readFileSync(newBuildComparisonPath, 'utf8'))
      const newBuildNum = typeof newComparisonData.buildNumber === 'string' ? 
        parseInt(newComparisonData.buildNumber) : newComparisonData.buildNumber
      expect(newBuildNum).toBeGreaterThan(126)
    })

    it('should include trend indicators in HTML report', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Trend Indicators Test',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // Should contain trend indicators
      expect(htmlContent).toContain('trend-indicator')
      
      // Should contain improvement indicators (GET /api/users improved from 275ms to ~193ms average)
      expect(htmlContent).toContain('↓')
      
      // Should contain degradation indicators (POST /api/orders degraded from 300ms to 400ms)
      expect(htmlContent).toContain('↑')
      
      // Should contain stable indicators
      expect(htmlContent).toContain('→')

      // Should contain trend classes
      expect(htmlContent).toContain('improved')
      expect(htmlContent).toContain('degraded')
      expect(htmlContent).toContain('stable')
    })

    it('should calculate performance deltas correctly', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Delta Calculation Test',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // Check for specific delta values (approximate)
      // GET /api/users: 275ms -> ~193ms = improvement of ~-82ms
      expect(htmlContent).toMatch(/-\d+ms/) // Should contain negative deltas (improvements)
      
      // POST /api/orders: 300ms -> 400ms = degradation of +100ms  
      expect(htmlContent).toMatch(/\+\d+ms/) // Should contain positive deltas (degradations)
    })
  })

  describe('HTML Report Build Comparison Integration', () => {
    beforeEach(async () => {
      // Create previous build data for these integration tests
      const previousBuildData = {
        buildNumber: 126,
        timestamp: Date.now() - 86400000,
        endpoints: {
          'GET /api/users': { average: 275, samples: 3, errorRate: 0, throughput: 1.2 },
          'POST /api/orders': { average: 300, samples: 2, errorRate: 0, throughput: 0.8 },
          'GET /api/products': { average: 185, samples: 2, errorRate: 0, throughput: 1.5 },
          'GET /api/analytics': { average: 1050, samples: 1, errorRate: 0, throughput: 0.5 },
          'PUT /api/profile': { average: 420, samples: 1, errorRate: 0, throughput: 0.3 },
          'DELETE /api/cache': { average: 145, samples: 1, errorRate: 0, throughput: 2.0 }
        }
      }

      await fs.promises.writeFile(previousBuildPath, JSON.stringify(previousBuildData, null, 2), 'utf8')
    })

    it('should generate HTML report with correct trend indicators and deltas', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'HTML Build Comparison Integration Test',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // Should contain all trend indicator elements
      expect(htmlContent).toContain('trend-indicator')
      expect(htmlContent).toContain('improved')
      expect(htmlContent).toContain('degraded')  
      expect(htmlContent).toContain('stable')

      // Should contain trend arrows
      expect(htmlContent).toContain('↓') // improvement arrow
      expect(htmlContent).toContain('↑') // degradation arrow
      expect(htmlContent).toContain('→') // stable arrow

      // Should contain delta values in tooltips
      expect(htmlContent).toContain('vs previous:')
      expect(htmlContent).toMatch(/[+-]\d+ms/) // Should contain delta values like +150ms or -30ms

      // Should have improved styling classes
      expect(htmlContent).toContain('trend-indicator improved')
      expect(htmlContent).toContain('trend-indicator degraded')
      expect(htmlContent).toContain('trend-indicator stable')
    })

    it('should calculate performance trends correctly', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Performance Trend Calculation Test',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // Parse the HTML to extract actual endpoint statistics
      const endpointMatches = htmlContent.match(/<tr[^>]*>(.*?)<\/tr>/gs) || []
      const relevantRows = endpointMatches.filter(row => 
        row.includes('GET /api/users') || 
        row.includes('POST /api/orders') || 
        row.includes('GET /api/analytics')
      )

      // Verify GET /api/users improved (275ms -> ~193ms avg)
      const usersRow = relevantRows.find(row => row.includes('GET /api/users'))
      if (usersRow) {
        expect(usersRow).toContain('trend-indicator improved')
        expect(usersRow).toContain('↓')
      }

      // Verify POST /api/orders degraded (300ms -> 400ms avg)  
      const ordersRow = relevantRows.find(row => row.includes('POST /api/orders'))
      if (ordersRow) {
        expect(ordersRow).toContain('trend-indicator degraded')
        expect(ordersRow).toContain('↑')
      }

      // Verify GET /api/analytics degraded (1050ms -> 1250ms)
      const analyticsRow = relevantRows.find(row => row.includes('GET /api/analytics'))
      if (analyticsRow) {
        expect(analyticsRow).toContain('trend-indicator degraded')
        expect(analyticsRow).toContain('↑')
      }
    })

    it('should handle missing build comparison data gracefully in HTML', async () => {
      // Generate report without previous build data
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'No Previous Build Data Test',
        compareToPrevious: true,
        buildComparisonPath: '/nonexistent/path/.build-comparison.json'
      })

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // When previous data is missing, should not contain trend indicators
      // (since calculatePerformanceDeltas returns original stats when previousBuildData is null)
      expect(htmlContent).not.toContain('trend-indicator')
      expect(htmlContent).not.toContain('↓')
      expect(htmlContent).not.toContain('↑')
      expect(htmlContent).not.toContain('→')

      // Should still generate valid HTML report
      expect(htmlContent).toContain('<!DOCTYPE html>')
      expect(htmlContent).toContain('Endpoint Statistics')
      expect(htmlContent).toContain('Total Requests')
    })

    it('should include build comparison data in generated build comparison file', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Build Data Generation Test',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      // Check the newly generated build comparison file
      const newBuildComparisonPath = path.join(reportOutputPath, '.build-comparison.json')
      expect(fs.existsSync(newBuildComparisonPath)).toBe(true)

      const newBuildData = JSON.parse(fs.readFileSync(newBuildComparisonPath, 'utf8'))
      
      // Should have correct structure
      expect(newBuildData).toHaveProperty('buildNumber')
      expect(newBuildData).toHaveProperty('timestamp')
      expect(newBuildData).toHaveProperty('endpoints')
      expect(typeof newBuildData.endpoints).toBe('object')

      // Should include all endpoints from the current test
      expect(newBuildData.endpoints).toHaveProperty('GET /api/users')
      expect(newBuildData.endpoints).toHaveProperty('POST /api/orders')
      expect(newBuildData.endpoints).toHaveProperty('GET /api/analytics')

      // Each endpoint should have required properties
      const usersEndpoint = newBuildData.endpoints['GET /api/users']
      expect(usersEndpoint).toHaveProperty('average')
      expect(usersEndpoint).toHaveProperty('samples')
      expect(usersEndpoint).toHaveProperty('errorRate')
      expect(usersEndpoint).toHaveProperty('throughput')
      expect(typeof usersEndpoint.average).toBe('number')
      expect(typeof usersEndpoint.samples).toBe('number')
    })
  })

  describe('XML Generation with Build Comparison', () => {
    beforeEach(async () => {
      // Create previous build data for XML comparison tests
      const previousBuildData = {
        buildNumber: 125,
        timestamp: Date.now() - 86400000,
        endpoints: {
          'GET /api/users': { average: 200, samples: 3, errorRate: 0, throughput: 1.0 },
          'GET /api/analytics': { average: 800, samples: 1, errorRate: 0, throughput: 0.5 } // Will exceed threshold in current build
        }
      }

      await fs.promises.writeFile(previousBuildPath, JSON.stringify(previousBuildData, null, 2), 'utf8')
    })

    it('should generate XML with build comparison information', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'XML Build Comparison Test',
        compareToPrevious: true,
        generateXml: true,
        buildComparisonPath: previousBuildPath,
        performanceThresholds: {
          warningThreshold: 300,
          errorThreshold: 1000,
          errorRateThreshold: 0.05
        }
      })

      const xmlPath = path.join(reportOutputPath, 'performance-results.xml')
      expect(fs.existsSync(xmlPath)).toBe(true)

      const xmlContent = fs.readFileSync(xmlPath, 'utf8')

      // Should contain XML structure
      expect(xmlContent).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xmlContent).toContain('<testsuites')
      expect(xmlContent).toContain('<testsuite')
      expect(xmlContent).toContain('<testcase')

      // Should contain build comparison information in failure messages
      expect(xmlContent).toContain('vs previous')
      expect(xmlContent).toContain('Trend:')

      // Should have performance threshold failures
      expect(xmlContent).toContain('<failure')
      expect(xmlContent).toContain('exceeded error threshold')
    })

    it('should include trend information in XML failure messages', async () => {
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'XML Trend Information Test',
        compareToPrevious: true,
        generateXml: true,
        buildComparisonPath: previousBuildPath,
        performanceThresholds: {
          warningThreshold: 200,
          errorThreshold: 500,
          errorRateThreshold: 0.05
        }
      })

      const xmlPath = path.join(reportOutputPath, 'performance-results.xml')
      const xmlContent = fs.readFileSync(xmlPath, 'utf8')

      // Should contain trend analysis in CDATA sections
      expect(xmlContent).toContain('<![CDATA[')
      expect(xmlContent).toContain('vs previous')
      expect(xmlContent).toContain('Trend: Performance')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing previous build data gracefully', async () => {
      // Don't create previous build file
      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Missing Previous Data Test',
        compareToPrevious: true,
        buildComparisonPath: '/nonexistent/path/.build-comparison.json'
      })

      expect(result).toBeDefined()
      expect(fs.existsSync(path.join(reportOutputPath, 'index.html'))).toBe(true)

      // Should still generate build comparison file for next build
      const buildComparisonPath = path.join(reportOutputPath, '.build-comparison.json')
      expect(fs.existsSync(buildComparisonPath)).toBe(true)
    })

    it('should handle corrupted previous build data', async () => {
      // Create corrupted previous build data
      await fs.promises.writeFile(previousBuildPath, 'invalid json data', 'utf8')

      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Corrupted Data Test',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      expect(result).toBeDefined()
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(fs.existsSync(path.join(reportOutputPath, 'index.html'))).toBe(true)
    })

    it('should handle comparison when endpoint sets differ', async () => {
      // Create previous build data with different endpoints
      const differentEndpointsData = {
        buildNumber: 124,
        timestamp: Date.now() - 86400000,
        endpoints: {
          'GET /api/different': { average: 100, samples: 1, errorRate: 0, throughput: 1.0 },
          'POST /api/removed': { average: 200, samples: 1, errorRate: 0, throughput: 0.5 }
        }
      }

      await fs.promises.writeFile(previousBuildPath, JSON.stringify(differentEndpointsData, null, 2), 'utf8')

      const result = await generateJMeterReport({
        csv: testCsvPath,
        output: reportOutputPath,
        title: 'Different Endpoints Test',
        compareToPrevious: true,
        buildComparisonPath: previousBuildPath
      })

      expect(result).toBeDefined()
      expect(fs.existsSync(path.join(reportOutputPath, 'index.html'))).toBe(true)

      const htmlPath = path.join(result.outputPath, 'index.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // Current endpoints not in previous build should not have trend indicators
      // This test verifies the system handles new endpoints gracefully
      expect(htmlContent).toContain('Endpoint Statistics')
      expect(htmlContent).toContain('GET /api/users') // Current endpoint
      expect(htmlContent).toContain('GET /api/products') // Current endpoint
    })
  })
})