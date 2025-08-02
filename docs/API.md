# API Reference

Complete API reference for programmatic usage and CLI options of jmeter-style-reporter.

## 🖥️ CLI Commands

### Basic Usage
```bash
# Generate report from CSV
npx jmeter-style-reporter report data.csv

# With output directory and title
npx jmeter-style-reporter report data.csv --output ./reports --title "My Test"

# Jenkins integration with dashboard widgets
npx jmeter-style-reporter report data.csv --jenkins --embedded-charts
```

### Available Commands
- `report <csv-file>` - Generate HTML report from CSV file
- `collect <output>` - Start collecting performance data
- `--help` - Show help message
- `--version` - Show version

### CLI Options

#### Required
- `--csv <file>` - Input CSV file (JMeter format)

#### Report Configuration  
- `--output, -o <dir>` - Output directory (default: ./jmeter-report)
- `--title, -t <title>` - Report title
- `--theme <light|dark|auto>` - Report theme (default: auto)
- `--jenkins` - Generate Jenkins-compatible report (no external dependencies)
- `--embedded-charts` - Use embedded Chart.js for maximum compatibility

#### Build Comparison
- `--compare-to-previous` - Enable build-to-build comparison (default: true)
- `--no-compare-to-previous` - Disable build comparison
- `--build-comparison-path <file>` - Custom path to previous build data

#### Performance Thresholds
- `--performance-threshold-warning <ms>` - Warning threshold (default: 300ms)
- `--performance-threshold-error <ms>` - Error threshold (default: 1000ms)  
- `--error-rate-threshold <percent>` - Error rate threshold (default: 0.05 = 5%)

#### Output Formats
- `--generate-xml` - Create JUnit XML for Jenkins integration
- `--include-drill-down` - Include drill-down charts (default: true)
- `--include-apdex` - Include APDEX scoring (default: true)

#### Advanced Options
- `--apdex-threshold <ms>` - APDEX threshold for satisfying performance (default: 500ms)
- `--max-memory-usage <mb>` - Memory limit for large datasets (default: 1024MB)
- `--streaming-mode` - Enable streaming mode for very large CSV files

### Examples
```bash
# Full Jenkins integration
jmeter-style-reporter report performance-results.csv \
    --output ./reports \
    --title "API Performance Report" \
    --jenkins \
    --generate-xml \
    --performance-threshold-warning 300 \
    --performance-threshold-error 1000

# Large dataset processing
jmeter-style-reporter report large-dataset.csv \
    --streaming-mode \
    --max-memory-usage 2048 \
    --output ./large-report

# Custom build comparison
jmeter-style-reporter report current.csv \
    --build-comparison-path ./previous/.build-comparison.json \
    --title "Build #127 vs #126"
```

## 📊 Data Collection

### createCollector(options)

Creates a performance data collector for automatic CSV generation.

```typescript
import { createCollector } from 'jmeter-style-reporter'

const collector = createCollector({
  outputPath: './performance-data.csv',
  testName: 'API Load Test',
  bufferSize: 1000,
  flushInterval: 5000
})
```

#### Options
```typescript
interface CollectorOptions {
  outputPath: string           // CSV output file path
  testName?: string           // Test identifier  
  bufferSize?: number         // Buffer size (default: 1000)
  flushInterval?: number      // Auto-flush interval in ms (default: 5000)
  silent?: boolean           // Suppress logging (default: false)
  onFlush?: (count: number) => void    // Flush callback
  onError?: (error: Error) => void     // Error callback
}
```

### collector.recordMetric(metric)

Records a single performance metric.

```typescript
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: 245,
  statusCode: 200,
  method: 'GET',
  success: true,
  testName: 'Load Test',
  bytes: 1024
})
```

#### PerformanceMetric Interface
```typescript
interface PerformanceMetric {
  endpoint?: string
  responseTime?: number      // milliseconds
  statusCode?: number
  method?: string           // HTTP method
  timestamp?: number        // Unix timestamp
  success?: boolean
  testName?: string
  bytes?: number           // Response size
  customFields?: Record<string, any>
}
```

### collector.flush()

Flushes buffered data to CSV file.

```typescript
await collector.flush()
```

## 📈 Report Generation

### generateReport(options)

Generates JMeter-style HTML report from CSV data.

```typescript
import { generateReport } from 'jmeter-style-reporter'

const result = await generateReport({
  csv: './performance-data.csv',
  output: './reports',
  title: 'API Performance Report',
  compareToPrevious: true,
  jenkinsCompatible: true,
  generateXml: true
})
```

#### ReportOptions Interface
```typescript
interface ReportOptions {
  csv: string | string[]      // Input CSV file(s)
  output?: string            // Output directory (default: ./jmeter-report)
  title?: string             // Report title
  theme?: 'light' | 'dark' | 'auto'  // Theme (default: auto)
  compareToPrevious?: boolean         // Enable build comparison
  jenkinsCompatible?: boolean         // Generate self-contained HTML
  generateXml?: boolean              // Create JUnit XML
  performanceThresholds?: {
    warningThreshold?: number        // Warning threshold in ms
    errorThreshold?: number          // Error threshold in ms
    errorRateThreshold?: number      // Error rate threshold (0-1)
  }
  buildComparisonPath?: string       // Custom comparison file path
  maxMemoryUsageMB?: number         // Memory limit
}
```

#### ReportResult Interface
```typescript
interface ReportResult {
  reportPath: string         // Path to generated HTML report
  xmlPath?: string          // Path to JUnit XML (if generated)
  summaryPath?: string      // Path to summary JSON
  buildComparisonPath?: string  // Path to build comparison data
  statistics: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    endpoints: number
  }
}
```

## 🔧 Express.js Middleware

### performanceMiddleware(collector)

Express middleware for automatic performance tracking.

```typescript
import express from 'express'
import { createCollector, performanceMiddleware } from 'jmeter-style-reporter'

const app = express()
const collector = createCollector({ outputPath: './api-performance.csv' })

// Add performance tracking to all routes
app.use(performanceMiddleware(collector))

app.get('/api/users', (req, res) => {
  res.json({ users: [] })
})

// Generate report on shutdown
process.on('SIGTERM', async () => {
  await collector.flush()
  await generateReport({
    csv: './api-performance.csv',
    output: './reports'
  })
})
```

#### Middleware Options
```typescript
interface MiddlewareOptions {
  includeRoutes?: string[]     // Only track these routes
  excludeRoutes?: string[]     // Exclude these routes
  trackHeaders?: boolean       // Track request/response headers
  trackBody?: boolean         // Track request/response body size
}

app.use(performanceMiddleware(collector, {
  excludeRoutes: ['/health', '/metrics'],
  trackHeaders: true
}))
```

## 🎯 Build Comparison

### loadPreviousBuildData(path)

Load previous build comparison data.

```typescript
import { loadPreviousBuildData } from 'jmeter-style-reporter'

const previousData = await loadPreviousBuildData('./.build-comparison.json')
```

### calculatePerformanceDeltas(current, previous)

Calculate performance deltas between builds.

```typescript
import { calculatePerformanceDeltas } from 'jmeter-style-reporter'

const deltas = calculatePerformanceDeltas(currentStats, previousStats)
// Returns array with averageDelta and performanceTrend for each endpoint
```

## 📋 Utilities

### validateCSVFormat(csvPath)

Validate CSV file format compatibility.

```typescript
import { validateCSVFormat } from 'jmeter-style-reporter'

const isValid = await validateCSVFormat('./performance-data.csv')
if (!isValid) {
  console.error('CSV format is not JMeter-compatible')
}
```

### convertToJMeterFormat(data)

Convert custom data to JMeter CSV format.

```typescript
import { convertToJMeterFormat } from 'jmeter-style-reporter'

const jmeterData = convertToJMeterFormat([
  {
    url: '/api/users',
    duration: 245,
    status: 200,
    timestamp: Date.now()
  }
])
```

## 🔍 Error Handling

### Common Error Types

```typescript
try {
  await generateReport(options)
} catch (error) {
  if (error.code === 'CSV_NOT_FOUND') {
    console.error('CSV file not found:', error.path)
  } else if (error.code === 'INVALID_CSV_FORMAT') {
    console.error('Invalid CSV format:', error.message)
  } else if (error.code === 'MEMORY_LIMIT_EXCEEDED') {
    console.error('Memory limit exceeded, try reducing data size')
  }
}
```

### Error Codes
- `CSV_NOT_FOUND`: Input CSV file doesn't exist
- `INVALID_CSV_FORMAT`: CSV doesn't match JMeter format
- `MEMORY_LIMIT_EXCEEDED`: Data too large for memory limit
- `TEMPLATE_ERROR`: Error processing external template
- `XML_GENERATION_ERROR`: Error generating JUnit XML

## 📊 Performance Monitoring

### Real-time Monitoring

```typescript
const collector = createCollector({
  outputPath: './performance.csv',
  onFlush: (count) => {
    console.log(`Flushed ${count} metrics to CSV`)
  },
  onError: (error) => {
    console.error('Collection error:', error)
  }
})

// Monitor collection performance
setInterval(async () => {
  const stats = collector.getStats()
  console.log('Buffer size:', stats.bufferSize)
  console.log('Total recorded:', stats.totalRecorded)
}, 10000)
```

### Custom Metrics

```typescript
// Add custom fields to metrics
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: 245,
  statusCode: 200,
  customFields: {
    userId: '123',
    cacheHit: true,
    dbQueries: 3
  }
})
```

## 🎨 Template Customization

### Using External Templates

```typescript
await generateReport({
  csv: './data.csv',
  output: './reports',
  useExternalTemplate: true,  // Uses template.js and chart-generator.js
  templatePath: './custom-template.js'  // Optional custom template
})
```

### Template Data Structure

```typescript
interface TemplateData {
  totalCalls: number
  avgTime: string
  endpointCount: number
  fastCount: number
  mediumCount: number
  slowCount: number
  endpoints: Array<{
    endpoint: string
    method: string
    avg: number
    min: number
    max: number
    calls: number
    status: 'FAST' | 'MEDIUM' | 'SLOW'
    averageDelta?: number        // Build comparison
    performanceTrend?: string    // 'improved' | 'degraded' | 'stable'
  }>
}
```