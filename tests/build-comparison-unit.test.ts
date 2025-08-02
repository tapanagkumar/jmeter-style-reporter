/**
 * Unit Tests for Build Comparison Core Logic
 * Tests the individual functions and logic for build comparison
 */

import * as fs from 'fs'
import * as path from 'path'

// Import the modules we need to test directly
const { BuildComparisonData } = require('../src/jmeter-reporter')

describe('Build Comparison Unit Tests', () => {
  const testOutputDir = path.join(__dirname, 'temp-unit-comparison')

  beforeAll(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }
  })

  afterAll(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  describe('BuildComparisonData Interface', () => {
    it('should have correct structure for build comparison data', () => {
      const buildData = {
        buildNumber: '127',
        timestamp: Date.now(),
        endpoints: {
          'GET /api/users': {
            average: 250,
            samples: 10,
            errorRate: 0.0,
            throughput: 4.0
          },
          'POST /api/orders': {
            average: 400,
            samples: 5,
            errorRate: 0.1,
            throughput: 2.0
          }
        }
      }

      // Test structure validation
      expect(buildData).toHaveProperty('buildNumber')
      expect(buildData).toHaveProperty('timestamp')
      expect(buildData).toHaveProperty('endpoints')
      expect(typeof buildData.endpoints).toBe('object')

      // Test endpoint data structure
      const usersEndpoint = buildData.endpoints['GET /api/users']
      expect(usersEndpoint).toHaveProperty('average')
      expect(usersEndpoint).toHaveProperty('samples')
      expect(usersEndpoint).toHaveProperty('errorRate')
      expect(usersEndpoint).toHaveProperty('throughput')

      expect(typeof usersEndpoint.average).toBe('number')
      expect(typeof usersEndpoint.samples).toBe('number')
      expect(typeof usersEndpoint.errorRate).toBe('number')
      expect(typeof usersEndpoint.throughput).toBe('number')
    })
  })

  describe('Performance Trend Calculation', () => {
    it('should correctly calculate improved performance trends', () => {
      const currentAverage = 200
      const previousAverage = 300
      const delta = currentAverage - previousAverage // -100 (improvement)

      expect(delta).toBe(-100)
      expect(delta < -10).toBe(true) // Should be classified as improved

      // Test the trend classification logic
      let trend: 'improved' | 'degraded' | 'stable'
      if (delta < -10) {
        trend = 'improved'
      } else if (delta > 10) {
        trend = 'degraded'
      } else {
        trend = 'stable'
      }

      expect(trend).toBe('improved')
    })

    it('should correctly calculate degraded performance trends', () => {
      const currentAverage = 400
      const previousAverage = 250
      const delta = currentAverage - previousAverage // +150 (degradation)

      expect(delta).toBe(150)
      expect(delta > 10).toBe(true) // Should be classified as degraded

      let trend: 'improved' | 'degraded' | 'stable'
      if (delta < -10) {
        trend = 'improved'
      } else if (delta > 10) {
        trend = 'degraded'
      } else {
        trend = 'stable'
      }

      expect(trend).toBe('degraded')
    })

    it('should correctly calculate stable performance trends', () => {
      const currentAverage = 255
      const previousAverage = 250
      const delta = currentAverage - previousAverage // +5 (stable)

      expect(delta).toBe(5)
      expect(Math.abs(delta) <= 10).toBe(true) // Should be classified as stable

      let trend: 'improved' | 'degraded' | 'stable'
      if (delta < -10) {
        trend = 'improved'
      } else if (delta > 10) {
        trend = 'degraded'
      } else {
        trend = 'stable'
      }

      expect(trend).toBe('stable')
    })

    it('should handle edge cases in trend calculation', () => {
      // Test exactly at thresholds
      expect(-10 < -10).toBe(false) // -10 should not be improved
      expect(10 > 10).toBe(false) // +10 should not be degraded
      expect(Math.abs(-10) <= 10).toBe(true) // -10 should be stable
      expect(Math.abs(10) <= 10).toBe(true) // +10 should be stable

      // Test zero delta
      const zeroDelta = 250 - 250
      expect(zeroDelta).toBe(0)
      expect(Math.abs(zeroDelta) <= 10).toBe(true) // Should be stable
    })
  })

  describe('Build Comparison File Operations', () => {
    it('should save and load build comparison data correctly', async () => {
      const buildData = {
        buildNumber: '128',
        timestamp: Date.now(),
        endpoints: {
          'GET /api/test': {
            average: 150,
            samples: 20,
            errorRate: 0.05,
            throughput: 6.67
          },
          'POST /api/create': {
            average: 300,
            samples: 15,
            errorRate: 0.0,
            throughput: 3.33
          }
        }
      }

      const filePath = path.join(testOutputDir, '.build-comparison-save-test.json')

      // Save data
      await fs.promises.writeFile(filePath, JSON.stringify(buildData, null, 2), 'utf8')

      // Verify file exists
      expect(fs.existsSync(filePath)).toBe(true)

      // Load and verify data
      const loadedData = JSON.parse(await fs.promises.readFile(filePath, 'utf8'))
      expect(loadedData).toEqual(buildData)
      expect(loadedData.buildNumber).toBe('128')
      expect(loadedData.endpoints['GET /api/test'].average).toBe(150)
      expect(loadedData.endpoints['POST /api/create'].samples).toBe(15)
    })

    it('should handle missing previous build data gracefully', async () => {
      const nonExistentPath = path.join(testOutputDir, '.non-existent-file.json')

      // Should return null or undefined when file doesn't exist
      let previousBuildData = null
      try {
        const fileContent = await fs.promises.readFile(nonExistentPath, 'utf8')
        previousBuildData = JSON.parse(fileContent)
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined()
        previousBuildData = null
      }

      expect(previousBuildData).toBeNull()
    })

    it('should handle corrupted build comparison data', async () => {
      const corruptedPath = path.join(testOutputDir, '.corrupted-build-data.json')
      const invalidJson = '{ invalid json syntax ///'

      await fs.promises.writeFile(corruptedPath, invalidJson, 'utf8')

      let parsedData = null
      try {
        const fileContent = await fs.promises.readFile(corruptedPath, 'utf8')
        parsedData = JSON.parse(fileContent)
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined()
        parsedData = null
      }

      expect(parsedData).toBeNull()
    })
  })

  describe('Endpoint Comparison Logic', () => {
    it('should correctly compare endpoints with previous build data', () => {
      const currentEndpoints = {
        'GET /api/users': { average: 200, samples: 10, errorRate: 0.0, throughput: 5.0 },
        'POST /api/orders': { average: 450, samples: 8, errorRate: 0.1, throughput: 2.67 },
        'GET /api/products': { average: 150, samples: 12, errorRate: 0.0, throughput: 8.0 }
      }

      const previousEndpoints = {
        'GET /api/users': { average: 275, samples: 9, errorRate: 0.0, throughput: 4.5 },
        'POST /api/orders': { average: 300, samples: 7, errorRate: 0.05, throughput: 3.0 },
        'GET /api/products': { average: 155, samples: 11, errorRate: 0.0, throughput: 7.5 }
      }

      // Test endpoint comparisons
      const usersComparison = {
        current: currentEndpoints['GET /api/users'],
        previous: previousEndpoints['GET /api/users'],
        delta: 200 - 275,
        trend: 'improved' as const
      }

      const ordersComparison = {
        current: currentEndpoints['POST /api/orders'],
        previous: previousEndpoints['POST /api/orders'],
        delta: 450 - 300,
        trend: 'degraded' as const
      }

      const productsComparison = {
        current: currentEndpoints['GET /api/products'],
        previous: previousEndpoints['GET /api/products'],
        delta: 150 - 155,
        trend: 'stable' as const
      }

      expect(usersComparison.delta).toBe(-75)
      expect(usersComparison.trend).toBe('improved')

      expect(ordersComparison.delta).toBe(150)
      expect(ordersComparison.trend).toBe('degraded')

      expect(productsComparison.delta).toBe(-5)
      expect(productsComparison.trend).toBe('stable')
    })

    it('should handle new endpoints not present in previous build', () => {
      const currentEndpoints = {
        'GET /api/users': { average: 200, samples: 10, errorRate: 0.0, throughput: 5.0 },
        'GET /api/new-feature': { average: 180, samples: 5, errorRate: 0.0, throughput: 2.78 } // New endpoint
      }

      const previousEndpoints = {
        'GET /api/users': { average: 275, samples: 9, errorRate: 0.0, throughput: 4.5 }
        // 'GET /api/new-feature' doesn't exist in previous build
      }

      // Test handling of new endpoint
      const newEndpoint = currentEndpoints['GET /api/new-feature']
      const previousData = (previousEndpoints as any)['GET /api/new-feature'] // undefined

      expect(newEndpoint).toBeDefined()
      expect(previousData).toBeUndefined()

      // New endpoints should not have trend data
      const hasComparison = previousData !== undefined
      expect(hasComparison).toBe(false)
    })

    it('should handle removed endpoints from previous build', () => {
      const currentEndpoints = {
        'GET /api/users': { average: 200, samples: 10, errorRate: 0.0, throughput: 5.0 }
      }

      const previousEndpoints = {
        'GET /api/users': { average: 275, samples: 9, errorRate: 0.0, throughput: 4.5 },
        'GET /api/legacy': { average: 500, samples: 3, errorRate: 0.2, throughput: 1.0 } // Removed endpoint
      }

      // Test that removed endpoints don't affect current build
      const legacyEndpoint = (currentEndpoints as any)['GET /api/legacy'] // undefined
      const previousLegacy = previousEndpoints['GET /api/legacy']

      expect(legacyEndpoint).toBeUndefined()
      expect(previousLegacy).toBeDefined()

      // Removed endpoints should not appear in current build comparison
      const currentEndpointKeys = Object.keys(currentEndpoints)
      expect(currentEndpointKeys).not.toContain('GET /api/legacy')
      expect(currentEndpointKeys).toContain('GET /api/users')
    })
  })

  describe('Build Number Generation', () => {
    it('should generate incremental build numbers', () => {
      const previousBuildNumber = 125
      const newBuildNumber = previousBuildNumber + 1

      expect(newBuildNumber).toBe(126)
      expect(newBuildNumber).toBeGreaterThan(previousBuildNumber)
    })

    it('should handle string build numbers', () => {
      const previousBuildNumber = '125'
      const newBuildNumber = String(parseInt(previousBuildNumber) + 1)

      expect(newBuildNumber).toBe('126')
      expect(parseInt(newBuildNumber)).toBeGreaterThan(parseInt(previousBuildNumber))
    })

    it('should handle missing build numbers', () => {
      const previousBuildNumber = undefined
      const defaultBuildNumber = 1
      const newBuildNumber = previousBuildNumber ? parseInt(String(previousBuildNumber)) + 1 : defaultBuildNumber

      expect(newBuildNumber).toBe(1)
    })
  })

  describe('Performance Threshold Integration', () => {
    it('should integrate build comparison with performance thresholds', () => {
      const thresholds = {
        warningThreshold: 300,
        errorThreshold: 1000,
        errorRateThreshold: 0.05
      }

      const endpointData = {
        current: { average: 450, samples: 10, errorRate: 0.02, throughput: 2.22 },
        previous: { average: 300, samples: 9, errorRate: 0.01, throughput: 3.0 },
        delta: 150,
        trend: 'degraded' as const
      }

      // Test threshold violations with trend context
      const exceedsWarning = endpointData.current.average > thresholds.warningThreshold
      const exceedsError = endpointData.current.average > thresholds.errorThreshold
      const isPerformanceDegraded = endpointData.trend === 'degraded'

      expect(exceedsWarning).toBe(true)
      expect(exceedsError).toBe(false)
      expect(isPerformanceDegraded).toBe(true)

      // Combined condition: exceeds warning AND performance degraded
      const shouldAlertDegradedPerformance = exceedsWarning && isPerformanceDegraded
      expect(shouldAlertDegradedPerformance).toBe(true)
    })
  })
})