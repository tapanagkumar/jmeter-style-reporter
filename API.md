# API Documentation

Complete API reference for the JMeter Style Reporter unified performance testing and reporting system.

## Table of Contents

- [Core APIs](#core-apis)
- [Collection API](#collection-api)
- [Reporting API](#reporting-api)
- [Unified Workflows](#unified-workflows)
- [Framework Integrations](#framework-integrations)
- [Types and Interfaces](#types-and-interfaces)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)

## Core APIs

### Main Entry Points

```typescript
import {
  // Collection
  createCollector,
  createHighThroughputCollector,
  
  // Reporting
  generateReport,
  validateCsv,
  
  // Unified Workflows
  runTestWithReporting,
  createRealtimeMonitor,
  
  // Framework Integrations
  performanceMiddleware,
  addPerformanceInterceptor,
  withPerformanceTracking,
  
  // Types
  CollectorOptions,
  ReportOptions,
  PerformanceMetric
} from 'jmeter-style-reporter'
```

## Collection API

### createCollector(options)

Creates a new performance data collector for recording metrics during testing.

```typescript
function createCollector(options: CollectorOptions): PerformanceCollector
```

#### Parameters

```typescript
interface CollectorOptions {
  outputPath: string           // Required: CSV output file path
  testName?: string           // Test identifier (default: 'default')
  bufferSize?: number         // Buffer size (default: 1000)
  flushInterval?: number      // Auto-flush interval in ms (default: 5000)
  maxFileSize?: number        // File rotation size (default: 100MB)
  enableRotation?: boolean    // Enable file rotation (default: true)
  compression?: boolean       // Enable gzip compression (default: false)
  highThroughput?: boolean    // Optimize for high throughput (default: false)
  customFields?: string[]     // Additional CSV columns
  silent?: boolean           // Suppress logging (default: false)
  onFlush?: (count: number) => void    // Flush callback
  onError?: (error: Error) => void     // Error callback
}
```

#### Returns

```typescript
interface PerformanceCollector {
  recordMetric(metric: Partial<PerformanceMetric>): Promise<void>
  recordMetricSync(metric: Partial<PerformanceMetric>): void
  flush(): Promise<void>
  getStats(): CollectorStats
  getOutputPath(): string
  dispose(): Promise<void>
}
```

#### Example

```typescript
const collector = createCollector({
  outputPath: './performance-data.csv',
  testName: 'API Load Test',
  bufferSize: 2000,
  flushInterval: 3000,
  onFlush: (count) => console.log(`Flushed ${count} metrics`)
})

// Record a metric
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: 245,
  statusCode: 200,
  method: 'GET'
})

// Ensure all data is written
await collector.flush()
```

### createHighThroughputCollector(outputPath, options?)

Creates an optimized collector for high-throughput scenarios (1000+ metrics/second).

```typescript
function createHighThroughputCollector(
  outputPath: string, 
  options?: Partial<CollectorOptions>
): PerformanceCollector
```

#### Example

```typescript
const collector = createHighThroughputCollector('./high-volume.csv', {
  testName: 'Stress Test',
  bufferSize: 10000,
  flushInterval: 1000
})

// Optimized for high-volume recording
for (let i = 0; i < 10000; i++) {
  collector.recordMetricSync({
    endpoint: `/api/endpoint-${i % 10}`,
    responseTime: Math.random() * 500,
    statusCode: 200
  })
}

await collector.flush()
```

### PerformanceCollector Methods

#### recordMetric(metric)

Records a performance metric (async, thread-safe).

```typescript
async recordMetric(metric: Partial<PerformanceMetric>): Promise<void>
```

#### recordMetricSync(metric)

Records a performance metric synchronously (higher throughput, use with caution in concurrent scenarios).

```typescript
recordMetricSync(metric: Partial<PerformanceMetric>): void
```

#### flush()

Forces immediate write of all buffered metrics to disk.

```typescript
async flush(): Promise<void>
```

#### getStats()

Returns current collector statistics.

```typescript
getStats(): CollectorStats

interface CollectorStats {
  totalMetrics: number
  bufferedMetrics: number
  flushCount: number
  errorCount: number
  bytesWritten: number
  isActive: boolean
}
```

#### dispose()

Cleanly shuts down the collector and releases resources.

```typescript
async dispose(): Promise<void>
```

## Reporting API

### generateReport(options)

Generates a JMeter-style HTML report from CSV data.

```typescript
async function generateReport(options: ReportOptions): Promise<ReportResult>
```

#### Parameters

```typescript
interface ReportOptions {
  csv: string | string[]      // Input CSV file(s)
  output?: string            // Output directory (default: './jmeter-report')
  title?: string             // Report title
  theme?: 'light' | 'dark' | 'auto'  // Theme (default: 'auto')
  merge?: boolean            // Merge multiple files (default: false)
  percentiles?: number[]     // Custom percentiles (default: [50,90,95,99])
  maxDataPoints?: number     // Chart data limit (default: 1000)
  timeInterval?: number      // Time bucket size in ms (default: 60000)
  redact?: RegExp           // Endpoint redaction pattern
  customFields?: string[]   // Process custom CSV columns
}
```

#### Returns

```typescript
interface ReportResult {
  outputPath: string
  reportUrl: string
  summary: ReportSummary
  warnings: string[]
}

interface ReportSummary {
  totalRequests: number
  totalDuration: number
  endpoints: string[]
  errors: number
  timeRange: {
    start: Date
    end: Date
  }
  performance: {
    generationTime: number
    memoryUsage: number
    throughput: number
  }
}
```

#### Example

```typescript
const result = await generateReport({
  csv: ['./day1.csv', './day2.csv', './day3.csv'],
  output: './weekly-report',
  title: 'Weekly Performance Report',
  theme: 'dark',
  merge: true,
  percentiles: [50, 75, 90, 95, 99],
  redact: /\/api\/users\/\d+/  // Redact user IDs
})

console.log(`Report: ${result.reportUrl}`)
console.log(`Total requests: ${result.summary.totalRequests}`)
```

### validateCsv(csvPath)

Validates CSV file format and structure.

```typescript
async function validateCsv(csvPath: string): Promise<ValidationResult>

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  summary: {
    totalRows: number
    validRows: number
    columns: string[]
    sampleData: any[]
  }
}
```

#### Example

```typescript
const validation = await validateCsv('./performance-data.csv')

if (!validation.isValid) {
  console.error('CSV validation failed:')
  validation.errors.forEach(error => console.error(`- ${error}`))
} else {
  console.log(`✓ Valid CSV with ${validation.summary.totalRows} rows`)
}
```

## Unified Workflows

### runTestWithReporting(config)

Executes a test function with automatic data collection and report generation.

```typescript
async function runTestWithReporting(config: TestConfig): Promise<TestResult>

interface TestConfig {
  testFunction: (collector: PerformanceCollector) => Promise<void>
  collection: CollectorOptions
  reporting: ReportOptions
  cleanup?: boolean  // Auto-cleanup CSV after reporting (default: false)
}

interface TestResult {
  dataPath: string
  reportPath: string
  summary: ReportSummary
  duration: number
}
```

#### Example

```typescript
const result = await runTestWithReporting({
  testFunction: async (collector) => {
    // Your test logic
    for (let i = 0; i < 1000; i++) {
      const start = performance.now()
      const response = await fetch('/api/endpoint')
      const duration = performance.now() - start
      
      await collector.recordMetric({
        endpoint: '/api/endpoint',
        responseTime: duration,
        statusCode: response.status
      })
    }
  },
  collection: {
    outputPath: './load-test.csv',
    testName: 'Load Test',
    bufferSize: 500
  },
  reporting: {
    output: './load-test-report',
    title: 'Load Test Results',
    theme: 'dark'
  },
  cleanup: true  // Remove CSV after report generation
})

console.log(`Test completed in ${result.duration}ms`)
console.log(`Report: ${result.reportPath}`)
```

### createRealtimeMonitor(options)

Creates a real-time performance monitoring dashboard.

```typescript
function createRealtimeMonitor(options: MonitorOptions): RealtimeMonitor

interface MonitorOptions {
  port?: number              // Dashboard port (default: 3000)
  metricsPath: string       // CSV file to monitor
  updateInterval?: number   // Update frequency in ms (default: 1000)
  maxPoints?: number        // Max data points to display (default: 100)
  theme?: 'light' | 'dark'  // Dashboard theme
}

interface RealtimeMonitor {
  start(): Promise<void>
  stop(): Promise<void>
  getUrl(): string
  getStats(): MonitorStats
}
```

#### Example

```typescript
const monitor = createRealtimeMonitor({
  port: 3001,
  metricsPath: './live-performance.csv',
  updateInterval: 500,
  theme: 'dark'
})

// Start monitoring dashboard
await monitor.start()
console.log(`Dashboard available at: ${monitor.getUrl()}`)

// Run your tests while monitoring
const collector = createCollector({
  outputPath: './live-performance.csv'
})

// ... run tests ...

// Stop monitoring
await monitor.stop()
```

## Framework Integrations

### Express.js Middleware

#### performanceMiddleware(collector, options?)

Middleware to automatically track Express.js route performance.

```typescript
function performanceMiddleware(
  collector: PerformanceCollector,
  options?: MiddlewareOptions
): RequestHandler

interface MiddlewareOptions {
  includeQuery?: boolean     // Include query params in endpoint (default: false)
  includeUserAgent?: boolean // Track user agent (default: false)
  skipPaths?: RegExp[]      // Paths to skip tracking
  customLabels?: (req: Request) => Record<string, any>
}
```

#### Example

```typescript
import express from 'express'
import { createCollector, performanceMiddleware } from 'jmeter-style-reporter'

const app = express()
const collector = createCollector('./api-performance.csv')

// Track all routes
app.use(performanceMiddleware(collector, {
  includeQuery: true,
  skipPaths: [/^\/health/, /^\/metrics/],
  customLabels: (req) => ({
    userId: req.headers['x-user-id'],
    region: req.headers['x-region']
  })
}))

// Your routes
app.get('/api/users', (req, res) => {
  res.json({ users: [] })
})

// Graceful shutdown with report generation
process.on('SIGTERM', async () => {
  await collector.flush()
  await generateReport({
    csv: './api-performance.csv',
    output: './api-reports'
  })
  process.exit(0)
})
```

### Axios Interceptor

#### addPerformanceInterceptor(collector, axiosInstance, options?)

Adds performance tracking to Axios HTTP client.

```typescript
function addPerformanceInterceptor(
  collector: PerformanceCollector,
  axiosInstance: AxiosInstance,
  options?: InterceptorOptions
): void

interface InterceptorOptions {
  includeRequestData?: boolean   // Track request payload size
  includeResponseData?: boolean  // Track response payload size
  labelExtractor?: (config: AxiosRequestConfig) => string
  errorHandler?: (error: any) => void
}
```

#### Example

```typescript
import axios from 'axios'
import { createCollector, addPerformanceInterceptor } from 'jmeter-style-reporter'

const collector = createCollector('./http-performance.csv')
const client = axios.create({
  baseURL: 'https://api.example.com'
})

// Add performance tracking
addPerformanceInterceptor(collector, client, {
  includeRequestData: true,
  includeResponseData: true,
  labelExtractor: (config) => `${config.method?.toUpperCase()} ${config.url}`,
  errorHandler: (error) => console.error('Performance tracking error:', error)
})

// All requests will be automatically tracked
await client.get('/users')
await client.post('/users', { name: 'John' })
await client.put('/users/1', { name: 'Jane' })

// Generate report
await collector.flush()
await generateReport({
  csv: './http-performance.csv',
  output: './http-reports'
})
```

### Jest Integration

#### withPerformanceTracking(testFn, options?)

Jest test wrapper for performance tracking.

```typescript
function withPerformanceTracking(
  testFn: (collector: PerformanceCollector) => Promise<void>,
  options?: JestOptions
): () => Promise<void>

interface JestOptions {
  outputPath?: string       // CSV output path (auto-generated if not provided)
  testName?: string        // Test name (uses Jest test name if not provided)
  generateReport?: boolean // Auto-generate report after test (default: false)
  thresholds?: {           // Performance thresholds
    maxResponseTime?: number
    maxErrorRate?: number
  }
}
```

#### Example

```typescript
import { createCollector, withPerformanceTracking, generateReport } from 'jmeter-style-reporter'

describe('API Performance Tests', () => {
  let collector: PerformanceCollector

  beforeAll(() => {
    collector = createCollector('./jest-performance.csv')
  })

  afterAll(async () => {
    await collector.flush()
    await generateReport({
      csv: './jest-performance.csv',
      output: './jest-reports',
      title: 'Jest Performance Tests'
    })
  })

  test('user endpoint should respond quickly', withPerformanceTracking(
    async (collector) => {
      const start = performance.now()
      const response = await fetch('/api/users')
      const duration = performance.now() - start

      await collector.recordMetric({
        endpoint: '/api/users',
        responseTime: duration,
        statusCode: response.status,
        testName: 'user endpoint performance'
      })

      // Performance assertions
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(500)
    },
    {
      thresholds: {
        maxResponseTime: 500,
        maxErrorRate: 0.01
      }
    }
  ))

  test('bulk operations performance', withPerformanceTracking(
    async (collector) => {
      const operations = []
      
      for (let i = 0; i < 100; i++) {
        const start = performance.now()
        const response = await fetch(`/api/users/${i}`)
        const duration = performance.now() - start

        await collector.recordMetric({
          endpoint: `/api/users/{id}`,
          responseTime: duration,
          statusCode: response.status,
          method: 'GET'
        })

        operations.push(duration)
      }

      // Aggregate performance assertions
      const avgDuration = operations.reduce((a, b) => a + b, 0) / operations.length
      const maxDuration = Math.max(...operations)
      
      expect(avgDuration).toBeLessThan(200)
      expect(maxDuration).toBeLessThan(1000)
    }
  ))
})
```

## Types and Interfaces

### Core Types

```typescript
interface PerformanceMetric {
  timestamp?: number         // Unix timestamp (auto-generated if not provided)
  elapsed?: number          // Response time in milliseconds
  endpoint?: string         // API endpoint or request identifier
  method?: string          // HTTP method
  responseCode?: number    // HTTP status code
  success?: boolean        // Success flag (auto-calculated from responseCode)
  bytes?: number          // Response size in bytes
  sentBytes?: number      // Request size in bytes
  testName?: string       // Test identifier
  userId?: string         // User identifier
  sessionId?: string      // Session identifier
  customFields?: Record<string, any>  // Additional custom data
}

interface CollectorStats {
  totalMetrics: number     // Total metrics recorded
  bufferedMetrics: number  // Metrics in buffer
  flushCount: number      // Number of flushes performed
  errorCount: number      // Number of errors encountered
  bytesWritten: number    // Total bytes written to disk
  isActive: boolean       // Whether collector is active
  startTime: number       // Collector start timestamp
  lastFlushTime: number   // Last flush timestamp
}

interface ReportSummary {
  totalRequests: number
  totalDuration: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  throughput: number
  errorRate: number
  endpoints: string[]
  errors: number
  timeRange: {
    start: Date
    end: Date
  }
  percentiles: {
    p50: number
    p90: number
    p95: number
    p99: number
  }
}
```

### Configuration Types

```typescript
interface CollectorOptions {
  outputPath: string
  testName?: string
  bufferSize?: number
  flushInterval?: number
  maxFileSize?: number
  enableRotation?: boolean
  compression?: boolean
  highThroughput?: boolean
  customFields?: string[]
  silent?: boolean
  onFlush?: (count: number) => void
  onError?: (error: Error) => void
  onMetric?: (metric: PerformanceMetric) => void
}

interface ReportOptions {
  csv: string | string[]
  output?: string
  title?: string
  theme?: 'light' | 'dark' | 'auto'
  merge?: boolean
  percentiles?: number[]
  maxDataPoints?: number
  timeInterval?: number
  redact?: RegExp
  customFields?: string[]
  includeRawData?: boolean
  generateSummary?: boolean
}

interface TestConfig {
  testFunction: (collector: PerformanceCollector) => Promise<void>
  collection: CollectorOptions
  reporting: ReportOptions
  cleanup?: boolean
  timeout?: number
  retries?: number
}
```

## Error Handling

### Error Types

```typescript
class PerformanceCollectorError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'PerformanceCollectorError'
  }
}

class CsvWriteError extends PerformanceCollectorError {}
class BufferOverflowError extends PerformanceCollectorError {}
class FileRotationError extends PerformanceCollectorError {}
class ReportGenerationError extends PerformanceCollectorError {}
```

### Error Handling Patterns

```typescript
// With error callbacks
const collector = createCollector({
  outputPath: './metrics.csv',
  onError: (error) => {
    if (error instanceof BufferOverflowError) {
      console.warn('Buffer overflow, increasing flush frequency')
      // Handle gracefully
    } else {
      console.error('Collector error:', error)
      // Log or report error
    }
  }
})

// With try-catch
try {
  await collector.recordMetric({
    endpoint: '/api/test',
    responseTime: 150
  })
} catch (error) {
  if (error instanceof CsvWriteError) {
    // Handle write errors specifically
    console.error('Failed to write metric:', error)
  } else {
    throw error  // Re-throw unexpected errors
  }
}

// Graceful degradation
const resilientCollector = createCollector({
  outputPath: './metrics.csv',
  onError: (error) => {
    console.warn('Performance collection error, continuing test:', error.message)
    // Test continues even if performance collection fails
  }
})
```

## Performance Optimization

### High-Throughput Collection

```typescript
// Optimized for maximum throughput
const collector = createHighThroughputCollector('./high-perf.csv', {
  bufferSize: 10000,        // Large buffer
  flushInterval: 500,       // Frequent flushes
  compression: false,       // Disable compression for speed
  silent: true,            // No logging overhead
  enableRotation: true,     // Prevent huge files
  maxFileSize: 100 * 1024 * 1024  // 100MB rotation
})

// Use sync recording for maximum speed (be careful with concurrency)
for (let i = 0; i < 100000; i++) {
  collector.recordMetricSync({
    endpoint: `/api/endpoint-${i % 100}`,
    responseTime: Math.random() * 1000,
    statusCode: 200
  })
}

await collector.flush()
```

### Memory Management

```typescript
// Memory-conscious configuration
const collector = createCollector({
  outputPath: './memory-efficient.csv',
  bufferSize: 100,          // Small buffer
  flushInterval: 1000,      // Frequent flushes
  enableRotation: true,     // File rotation
  maxFileSize: 10 * 1024 * 1024,  // 10MB files
  compression: true,        // Compress to save disk space
  
  // Monitor memory usage
  onFlush: (count) => {
    const memUsage = process.memoryUsage()
    console.log(`Flushed ${count} metrics, heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`)
  }
})
```

### Report Generation Optimization

```typescript
// Optimized report generation for large datasets
const result = await generateReport({
  csv: './large-dataset.csv',
  output: './optimized-report',
  maxDataPoints: 500,       // Reduce chart points
  timeInterval: 300000,     // 5-minute buckets
  percentiles: [50, 95, 99], // Fewer percentiles
  
  // Process in chunks for memory efficiency
  customFields: ['endpoint', 'responseTime', 'statusCode']  // Only needed fields
})
```

### Monitoring and Diagnostics

```typescript
// Enable performance monitoring
const collector = createCollector({
  outputPath: './monitored.csv',
  onFlush: (count) => console.log(`✓ Flushed ${count} metrics`),
  onError: (error) => console.error(`✗ Error: ${error.message}`),
  onMetric: (metric) => {
    // Real-time metric processing
    if (metric.responseTime! > 1000) {
      console.warn(`Slow response: ${metric.endpoint} - ${metric.responseTime}ms`)
    }
  }
})

// Get real-time statistics
setInterval(() => {
  const stats = collector.getStats()
  console.log(`Metrics: ${stats.totalMetrics}, Buffer: ${stats.bufferedMetrics}, Errors: ${stats.errorCount}`)
}, 5000)
```

This comprehensive API documentation covers all the features and capabilities of the unified performance testing and reporting system. Use it as a reference for implementing performance monitoring in your applications.