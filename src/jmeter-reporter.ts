/**
 * Enhanced JMeter Style Reporter
 * Provides comprehensive performance testing and reporting with JMeter compatibility
 */

import * as fs from 'fs'
import * as path from 'path'

export interface PerformanceMetric {
  endpoint?: string
  responseTime?: number
  statusCode?: number
  method?: string
  timestamp?: number
  success?: boolean
  testName?: string
  bytes?: number
  sentBytes?: number
  grpThreads?: number
  allThreads?: number
  customFields?: Record<string, any>
}

export interface CollectorOptions {
  outputPath: string
  testName?: string
  bufferSize?: number
  flushInterval?: number
  silent?: boolean
  onFlush?: (count: number) => void
  onError?: (error: Error) => void
  jmeterCompatible?: boolean
}

export interface ReportOptions {
  csv: string | string[]
  output?: string
  title?: string
  theme?: 'light' | 'dark' | 'auto'
  includePercentiles?: boolean
  includeApdex?: boolean
  apdexThreshold?: number
  includeDrillDown?: boolean
}

export interface ReportResult {
  outputPath: string
  reportUrl: string
  summary: {
    totalRequests: number
    averageResponseTime?: number
    errorRate: number
    throughput: number
    percentiles?: {
      p50: number
      p90: number
      p95: number
      p99: number
    }
    apdexScore?: number
  }
}

// JMeter CSV format record
interface JMeterRecord {
  timestamp: number
  elapsed: number
  label: string
  responseCode: number
  success: boolean
  bytes: number
  sentBytes: number
  grpThreads: number
  allThreads: number
  filename: string
}

interface EndpointStats {
  label: string
  samples: number
  average: number
  median: number
  p90: number
  p95: number
  p99: number
  min: number
  max: number
  errorRate: number
  throughput: number
  receivedKB: number
  avgBytes: number
  apdexScore?: number
}

interface TimeSeriesPoint {
  timestamp: number
  responseTime: number
  throughput: number
  errorRate: number
  activeThreads?: number
}

interface ErrorInfo {
  responseCode: number
  count: number
  percentage: number
  message: string
}

interface ApdexData {
  label: string
  score: number
  samples: number
  satisfied: number
  tolerating: number
  frustrated: number
}

/**
 * Enhanced Performance Collector with JMeter compatibility
 */
export class JMeterPerformanceCollector {
  private metrics: PerformanceMetric[] = []
  private options: CollectorOptions
  private flushTimer?: NodeJS.Timeout
  private disposed: boolean = false
  private readonly maxMetrics: number = 100000 // Prevent memory exhaustion
  private flushing: boolean = false
  private pendingFlush: Promise<void> | null = null

  constructor(options: CollectorOptions) {
    this.options = {
      bufferSize: 1000,
      flushInterval: 5000,
      silent: false,
      jmeterCompatible: true,
      ...options
    }

    // Validate buffer size to prevent memory issues
    if (this.options.bufferSize && this.options.bufferSize > 10000) {
      console.warn('Buffer size clamped to 10000 to prevent memory issues')
      this.options.bufferSize = 10000
    }

    if (this.options.flushInterval && this.options.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        if (!this.disposed) {
          this.flush().catch(err => {
            console.error('Flush error:', err)
            this.options.onError?.(err)
          })
        }
      }, this.options.flushInterval)
      
      // Ensure timer doesn't keep process alive unnecessarily
      this.flushTimer.unref?.()
    }

    // Add cleanup on process exit
    const cleanup = () => {
      if (!this.disposed) {
        this.dispose().catch(console.error)
      }
    }
    
    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('uncaughtException', cleanup)
  }

  async recordMetric(metric: Partial<PerformanceMetric>): Promise<void> {
    if (this.disposed) {
      console.warn('Cannot record metric: collector has been disposed')
      return
    }

    // Prevent memory exhaustion
    if (this.metrics.length >= this.maxMetrics) {
      console.warn(`Maximum metrics limit reached (${this.maxMetrics}), forcing flush`)
      await this.flush()
    }

    const fullMetric: PerformanceMetric = {
      timestamp: Date.now(),
      endpoint: sanitizeString(metric.endpoint || 'unknown'),
      responseTime: parseFloatSafe(String(metric.responseTime || 0)),
      statusCode: parseIntSafe(String(metric.statusCode || 200)),
      method: sanitizeString(metric.method || 'GET'),
      success: (metric.statusCode || 200) < 400,
      testName: sanitizeString(metric.testName || this.options.testName || 'default'),
      bytes: parseIntSafe(String(metric.bytes || 0)),
      sentBytes: parseIntSafe(String(metric.sentBytes || 0)),
      grpThreads: Math.max(1, parseIntSafe(String(metric.grpThreads || 1))),
      allThreads: Math.max(1, parseIntSafe(String(metric.allThreads || 1))),
      ...metric
    }

    this.metrics.push(fullMetric)

    if (this.metrics.length >= (this.options.bufferSize || 1000)) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    // Return existing flush promise if already flushing
    if (this.pendingFlush) {
      return this.pendingFlush
    }

    // No metrics to flush
    if (this.metrics.length === 0) {
      return
    }

    // Set up concurrency control
    this.pendingFlush = this._performFlush()
    
    try {
      await this.pendingFlush
    } finally {
      this.pendingFlush = null
    }
  }

  private async _performFlush(): Promise<void> {
    if (this.flushing || this.metrics.length === 0) {
      return
    }

    this.flushing = true
    
    try {
      // Take a snapshot of current metrics and clear the array atomically
      const metricsToFlush = [...this.metrics]
      this.metrics.length = 0

      if (metricsToFlush.length === 0) {
        return
      }

      // Use async file operations
      const { promises: fsPromises } = await import('fs')
      const path = await import('path')
      
      // Ensure directory exists
      const dir = path.dirname(this.options.outputPath)
      try {
        await fsPromises.mkdir(dir, { recursive: true })
      } catch (error: any) {
        if (error.code !== 'EEXIST') {
          throw error
        }
      }

      // Check if file exists
      let fileExists = false
      try {
        await fsPromises.access(this.options.outputPath)
        fileExists = true
      } catch {
        // File doesn't exist, we'll create it
      }

      // Create CSV header if file doesn't exist
      let csvContent = ''
      if (!fileExists) {
        const header = this.options.jmeterCompatible
          ? 'timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename\n'
          : 'timestamp,responseTime,endpoint,statusCode,success,method,testName\n'
        csvContent += header
      }

      // Generate CSV lines with proper escaping
      const csvLines = metricsToFlush.map(metric => {
        if (this.options.jmeterCompatible) {
          return [
            metric.timestamp,
            metric.responseTime,
            `"${escapeJavaScript(metric.endpoint || '')}"`,
            metric.statusCode,
            metric.success,
            metric.bytes || 0,
            metric.sentBytes || 0,
            metric.grpThreads || 1,
            metric.allThreads || 1,
            `"${escapeJavaScript(metric.testName || '')}"`
          ].join(',')
        } else {
          return [
            metric.timestamp,
            metric.responseTime,
            `"${escapeJavaScript(metric.endpoint || '')}"`,
            metric.statusCode,
            metric.success,
            escapeJavaScript(metric.method || ''),
            `"${escapeJavaScript(metric.testName || '')}"`
          ].join(',')
        }
      }).join('\n') + '\n'

      csvContent += csvLines

      // Write to file atomically
      await fsPromises.appendFile(this.options.outputPath, csvContent, 'utf8')
      
      const count = metricsToFlush.length
      
      if (!this.options.silent) {
        console.log(`✅ Flushed ${count} metrics to ${this.options.outputPath}`)
      }
      
      this.options.onFlush?.(count)
    } catch (error) {
      console.error('Flush failed:', error)
      this.options.onError?.(error as Error)
      throw error
    } finally {
      this.flushing = false
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }

    this.disposed = true

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }

    // Remove event listeners to prevent memory leaks
    try {
      process.removeAllListeners('exit')
      process.removeAllListeners('SIGINT')
      process.removeAllListeners('SIGTERM') 
      process.removeAllListeners('uncaughtException')
    } catch (error) {
      // Ignore errors if process cleanup fails
    }

    await this.flush()
    
    // Clear metrics array to free memory
    this.metrics.length = 0
  }
}

/**
 * Statistical calculation utilities
 */
export class StatisticsCalculator {
  static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  static calculateApdexScore(
    responseTimes: number[], 
    threshold: number = 500,
    label?: string
  ): ApdexData {
    if (responseTimes.length === 0) {
      return {
        label: label || 'Unknown',
        score: 0,
        samples: 0,
        satisfied: 0,
        tolerating: 0,
        frustrated: 0
      }
    }

    const satisfied = responseTimes.filter(rt => rt <= threshold).length
    const tolerating = responseTimes.filter(rt => rt > threshold && rt <= threshold * 4).length
    const frustrated = responseTimes.filter(rt => rt > threshold * 4).length
    const score = (satisfied + (tolerating * 0.5)) / responseTimes.length

    return {
      label: label || 'Unknown',
      score,
      samples: responseTimes.length,
      satisfied,
      tolerating,
      frustrated
    }
  }

  static calculateStandardDeviation(values: number[], mean: number): number {
    if (values.length === 0) return 0
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((sum, value) => sum + value, 0) / values.length
    return Math.sqrt(avgSquaredDiff)
  }
}

/**
 * Parse CSV line with proper handling of quoted fields and escaping
 * Handles edge cases like embedded commas, quotes, and line breaks
 */
function parseCSVLine(line: string): JMeterRecord | null {
  if (!line || line.trim().length === 0) {
    return null
  }

  try {
    const parts: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote within quoted field
          current += '"'
          i += 2
          continue
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        parts.push(current.trim())
        current = ''
        i++
        continue
      } else {
        current += char
      }
      i++
    }

    // Add the last field
    parts.push(current.trim())

    // Validate minimum field count
    if (parts.length < 10) {
      console.warn(`CSV line has insufficient fields: ${parts.length} < 10`)
      return null
    }

    // Parse with validation and sanitization
    const timestamp = parseIntSafe(parts[0])
    const elapsed = parseFloatSafe(parts[1])
    const responseCode = parseIntSafe(parts[3])

    // Validate required numeric fields
    if (isNaN(timestamp) || isNaN(elapsed) || isNaN(responseCode)) {
      console.warn(`Invalid numeric fields in CSV line: timestamp=${timestamp}, elapsed=${elapsed}, responseCode=${responseCode}`)
      return null
    }

    return {
      timestamp,
      elapsed,
      label: sanitizeString(parts[2]),
      responseCode,
      success: parts[4]?.toLowerCase().trim() === 'true',
      bytes: parseIntSafe(parts[5]) || 0,
      sentBytes: parseIntSafe(parts[6]) || 0,
      grpThreads: Math.max(1, parseIntSafe(parts[7]) || 1),
      allThreads: Math.max(1, parseIntSafe(parts[8]) || 1),
      filename: sanitizeString(parts[9] || '')
    }
  } catch (error) {
    console.error(`Failed to parse CSV line: ${error}`)
    return null
  }
}

/**
 * Safely parse integer with bounds checking
 */
function parseIntSafe(value: string | undefined): number {
  if (!value || value.trim().length === 0) {
    return 0
  }
  
  const parsed = parseInt(value.trim(), 10)
  
  // Check for valid number and reasonable bounds
  if (isNaN(parsed) || !isFinite(parsed)) {
    return 0
  }
  
  // Clamp to reasonable bounds to prevent memory issues
  return Math.max(0, Math.min(parsed, Number.MAX_SAFE_INTEGER))
}

/**
 * Safely parse float with bounds checking
 */
function parseFloatSafe(value: string | undefined): number {
  if (!value || value.trim().length === 0) {
    return 0
  }
  
  const parsed = parseFloat(value.trim())
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    return 0
  }
  
  // Clamp to reasonable bounds
  return Math.max(0, Math.min(parsed, Number.MAX_SAFE_INTEGER))
}

/**
 * Sanitize string fields to prevent XSS and data corruption
 */
function sanitizeString(value: string): string {
  if (!value) {
    return ''
  }
  
  return value
    .trim()
    .replace(/^"|"$/g, '') // Remove surrounding quotes
    .replace(/"/g, '&quot;') // Escape remaining quotes
    .replace(/</g, '&lt;') // Escape HTML
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;') // Escape ampersands last
    .substring(0, 1000) // Limit length to prevent memory issues
}

/**
 * Escape HTML content to prevent XSS attacks
 */
function escapeHtml(unsafe: string | number | undefined): string {
  if (unsafe === undefined || unsafe === null) {
    return ''
  }
  
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Escape JavaScript string literals to prevent injection
 */
function escapeJavaScript(unsafe: string): string {
  if (!unsafe) {
    return ''
  }
  
  return unsafe
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\0/g, '\\0')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

/**
 * Safely serialize data for JavaScript embedding
 */
function safeJsonStringify(data: any): string {
  try {
    return JSON.stringify(data, (key, value) => {
      if (typeof value === 'string') {
        return escapeJavaScript(value)
      }
      return value
    })
  } catch (error) {
    console.error('Failed to serialize data safely:', error)
    return '{}'
  }
}

/**
 * Get HTTP error message
 */
function getErrorMessage(code: number): string {
  const errorMessages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  }
  return errorMessages[code] || `HTTP ${code}`
}

/**
 * Create performance collector
 */
export function createCollector(options: CollectorOptions): JMeterPerformanceCollector {
  return new JMeterPerformanceCollector(options)
}

/**
 * Generate enhanced JMeter-style HTML report with streaming support
 */
export async function generateJMeterReport(options: ReportOptions): Promise<ReportResult> {
  const csvFiles = Array.isArray(options.csv) ? options.csv : [options.csv]
  const outputDir = options.output || './jmeter-report'
  
  // Use async operations
  const { promises: fsPromises } = await import('fs')
  const { createReadStream } = await import('fs')
  const { createInterface } = await import('readline')
  
  // Ensure output directory exists
  try {
    await fsPromises.mkdir(outputDir, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }

  // Parse all CSV data with streaming for large files
  const allRecords: JMeterRecord[] = []
  const maxRecordsInMemory = 50000 // Limit memory usage
  
  for (const csvFile of csvFiles) {
    try {
      await fsPromises.access(csvFile)
      
      const fileStream = createReadStream(csvFile, { encoding: 'utf8' })
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })

      let lineNumber = 0
      let recordCount = 0

      for await (const line of rl) {
        lineNumber++
        
        // Skip header line
        if (lineNumber === 1) {
          continue
        }

        if (line.trim()) {
          const record = parseCSVLine(line)
          if (record) {
            allRecords.push(record)
            recordCount++

            // Prevent memory exhaustion with very large files
            if (recordCount >= maxRecordsInMemory) {
              console.warn(`Reached maximum record limit (${maxRecordsInMemory}) for memory safety. Some data may be truncated.`)
              break
            }
          }
        }
      }

      rl.close()
      fileStream.destroy()
      
    } catch (error) {
      console.warn(`Warning: Could not parse CSV file ${csvFile}:`, error)
    }
  }

  if (allRecords.length === 0) {
    throw new Error('No valid data found in CSV files')
  }

  if (allRecords.length >= maxRecordsInMemory) {
    console.warn(`Processing ${allRecords.length} records. Large datasets may impact performance.`)
  }

  // Calculate test duration and time series data
  const startTime = Math.min(...allRecords.map(r => r.timestamp))
  const endTime = Math.max(...allRecords.map(r => r.timestamp))
  const testDuration = (endTime - startTime) / 1000 // in seconds

  // Group data by endpoint
  const endpointData = new Map<string, JMeterRecord[]>()
  allRecords.forEach(record => {
    if (!endpointData.has(record.label)) {
      endpointData.set(record.label, [])
    }
    endpointData.get(record.label)!.push(record)
  })

  // Calculate statistics for each endpoint
  const endpointStats: EndpointStats[] = []
  const apdexData: ApdexData[] = []
  
  for (const [label, records] of endpointData) {
    const responseTimes = records.map(r => r.elapsed)
    const errors = records.filter(r => !r.success).length
    const totalBytes = records.reduce((sum, r) => sum + r.bytes, 0)
    const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    
    const stats: EndpointStats = {
      label,
      samples: records.length,
      average,
      median: StatisticsCalculator.calculatePercentile(responseTimes, 50),
      p90: StatisticsCalculator.calculatePercentile(responseTimes, 90),
      p95: StatisticsCalculator.calculatePercentile(responseTimes, 95),
      p99: StatisticsCalculator.calculatePercentile(responseTimes, 99),
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      errorRate: errors / records.length,
      throughput: records.length / Math.max(testDuration, 1),
      receivedKB: totalBytes / 1024,
      avgBytes: totalBytes / records.length
    }

    if (options.includeApdex !== false) {
      const apdex = StatisticsCalculator.calculateApdexScore(
        responseTimes,
        options.apdexThreshold || 500,
        label
      )
      stats.apdexScore = apdex.score
      apdexData.push(apdex)
    }

    endpointStats.push(stats)
  }

  // Calculate time series data for charts
  const timeInterval = Math.max(Math.floor(testDuration / 100), 1) * 1000 // milliseconds
  const timeSeriesData: TimeSeriesPoint[] = []
  
  for (let t = startTime; t <= endTime; t += timeInterval) {
    const windowRecords = allRecords.filter(r => r.timestamp >= t && r.timestamp < t + timeInterval)
    if (windowRecords.length > 0) {
      const avgResponseTime = windowRecords.reduce((sum, r) => sum + r.elapsed, 0) / windowRecords.length
      const errors = windowRecords.filter(r => !r.success).length
      const activeThreads = Math.max(...windowRecords.map(r => r.allThreads))
      
      timeSeriesData.push({
        timestamp: t,
        responseTime: avgResponseTime,
        throughput: windowRecords.length / (timeInterval / 1000),
        errorRate: errors / windowRecords.length,
        activeThreads
      })
    }
  }

  // Calculate error summary
  const errorCounts = new Map<number, number>()
  allRecords.filter(r => !r.success).forEach(r => {
    errorCounts.set(r.responseCode, (errorCounts.get(r.responseCode) || 0) + 1)
  })

  const errorSummary: ErrorInfo[] = Array.from(errorCounts.entries())
    .map(([code, count]) => ({
      responseCode: code,
      count,
      percentage: (count / allRecords.length) * 100,
      message: getErrorMessage(code)
    }))
    .sort((a, b) => b.count - a.count)

  // Calculate overall summary
  const totalRequests = allRecords.length
  const errorCount = allRecords.filter(r => !r.success).length
  const allResponseTimes = allRecords.map(r => r.elapsed)
  const averageResponseTime = allResponseTimes.reduce((sum, r) => sum + r, 0) / totalRequests
  const errorRate = errorCount / totalRequests
  const throughput = totalRequests / Math.max(testDuration, 1)

  const summary: ReportResult['summary'] = {
    totalRequests,
    averageResponseTime,
    errorRate,
    throughput
  }

  if (options.includePercentiles !== false) {
    summary.percentiles = {
      p50: StatisticsCalculator.calculatePercentile(allResponseTimes, 50),
      p90: StatisticsCalculator.calculatePercentile(allResponseTimes, 90),
      p95: StatisticsCalculator.calculatePercentile(allResponseTimes, 95),
      p99: StatisticsCalculator.calculatePercentile(allResponseTimes, 99)
    }
  }

  if (options.includeApdex !== false) {
    const overallApdex = StatisticsCalculator.calculateApdexScore(
      allResponseTimes,
      options.apdexThreshold || 500
    )
    summary.apdexScore = overallApdex.score
  }

  // Generate the HTML report
  const htmlContent = generateEnhancedHTMLReport({
    title: options.title || 'JMeter Performance Dashboard',
    theme: options.theme || 'light',
    summary,
    endpointStats,
    timeSeriesData,
    errorSummary,
    apdexData,
    testDuration,
    allRecords,
    endpointData,
    includeDrillDown: options.includeDrillDown !== false
  })

  const reportPath = path.join(outputDir, 'index.html')
  await fsPromises.writeFile(reportPath, htmlContent, 'utf8')

  return {
    outputPath: outputDir,
    reportUrl: `file://${path.resolve(reportPath)}`,
    summary
  }
}

interface HTMLReportData {
  title: string
  theme: string
  summary: ReportResult['summary']
  endpointStats: EndpointStats[]
  timeSeriesData: TimeSeriesPoint[]
  errorSummary: ErrorInfo[]
  apdexData: ApdexData[]
  testDuration: number
  allRecords: JMeterRecord[]
  endpointData: Map<string, JMeterRecord[]>
  includeDrillDown: boolean
}

/**
 * Generate enhanced HTML report with Chart.js
 */
function generateEnhancedHTMLReport(data: HTMLReportData): string {
  const isDark = data.theme === 'dark'
  const bgColor = isDark ? '#1a1a1a' : '#f8f9fa'
  const cardBg = isDark ? '#2d3748' : '#ffffff'
  const textColor = isDark ? '#e2e8f0' : '#2d3748'
  const borderColor = isDark ? '#4a5568' : '#e2e8f0'
  const headerBg = isDark ? '#374151' : '#f7fafc'

  // Convert Map to serializable object for JavaScript
  const endpointDataForJs: Record<string, JMeterRecord[]> = {}
  data.endpointData.forEach((records, label) => {
    endpointDataForJs[label] = records
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(data.title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${bgColor};
            color: ${textColor};
            line-height: 1.6;
            font-size: 14px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: ${cardBg};
            border: 1px solid ${borderColor};
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 600;
            color: ${isDark ? '#fff' : '#1a202c'};
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.8;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: ${cardBg};
            padding: 20px;
            border: 1px solid ${borderColor};
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        
        .summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .summary-value {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .summary-label {
            font-size: 0.95rem;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .success { color: #10b981; }
        .warning { color: #f59e0b; }
        .error { color: #ef4444; }
        .info { color: #3b82f6; }
        
        .panel {
            background: ${cardBg};
            border: 1px solid ${borderColor};
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .panel-heading {
            padding: 15px 20px;
            border-bottom: 1px solid ${borderColor};
            background: ${headerBg};
            border-radius: 8px 8px 0 0;
        }
        
        .panel-title {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
            color: ${isDark ? '#fff' : '#1a202c'};
        }
        
        .panel-body {
            padding: 20px;
        }
        
        .chart-container {
            position: relative;
            height: 400px;
            margin-bottom: 20px;
        }
        
        .table-responsive {
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid ${borderColor};
        }
        
        th {
            background: ${headerBg};
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        tbody tr:hover {
            background: ${isDark ? '#374151' : '#f9fafb'};
        }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        .apdex-score {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
        }
        
        .apdex-excellent { background: #10b981; color: white; }
        .apdex-good { background: #3b82f6; color: white; }
        .apdex-fair { background: #f59e0b; color: white; }
        .apdex-poor { background: #ef4444; color: white; }
        
        .tabs {
            display: flex;
            border-bottom: 2px solid ${borderColor};
            margin-bottom: 20px;
        }
        
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            background: none;
            border: none;
            font-size: 16px;
            color: ${textColor};
            opacity: 0.7;
            transition: all 0.2s;
        }
        
        .tab:hover {
            opacity: 1;
        }
        
        .tab.active {
            opacity: 1;
            border-bottom: 3px solid #3b82f6;
            margin-bottom: -2px;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .drill-down-link {
            color: #3b82f6;
            cursor: pointer;
            text-decoration: none;
        }
        
        .drill-down-link:hover {
            text-decoration: underline;
        }
        
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        
        .modal-content {
            background-color: ${cardBg};
            margin: 5% auto;
            padding: 20px;
            border: 1px solid ${borderColor};
            border-radius: 8px;
            width: 90%;
            max-width: 1200px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .close {
            color: ${textColor};
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .close:hover {
            opacity: 0.7;
        }
        
        @media (max-width: 768px) {
            .summary-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 1.8rem;
            }
            
            .tab {
                font-size: 14px;
                padding: 8px 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHtml(data.title)}</h1>
            <p>Test Duration: ${(data.testDuration / 60).toFixed(2)} minutes | Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-value">${data.summary.totalRequests.toLocaleString()}</div>
                <div class="summary-label">Total Requests</div>
            </div>
            <div class="summary-card">
                <div class="summary-value ${data.summary.errorRate < 0.01 ? 'success' : data.summary.errorRate < 0.05 ? 'warning' : 'error'}">
                    ${(data.summary.errorRate * 100).toFixed(2)}%
                </div>
                <div class="summary-label">Error Rate</div>
            </div>
            <div class="summary-card">
                <div class="summary-value info">${data.summary.averageResponseTime?.toFixed(0)}ms</div>
                <div class="summary-label">Average Response Time</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${data.summary.throughput.toFixed(2)}/s</div>
                <div class="summary-label">Throughput</div>
            </div>
            ${data.summary.apdexScore !== undefined ? `
            <div class="summary-card">
                <div class="summary-value ${getApdexClass(data.summary.apdexScore)}">${data.summary.apdexScore.toFixed(3)}</div>
                <div class="summary-label">APDEX Score</div>
            </div>
            ` : ''}
            ${data.summary.percentiles ? `
            <div class="summary-card">
                <div class="summary-value">${data.summary.percentiles.p95.toFixed(0)}ms</div>
                <div class="summary-label">95th Percentile</div>
            </div>
            ` : ''}
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="showTab('charts')">Charts</button>
            <button class="tab" onclick="showTab('statistics')">Statistics</button>
            <button class="tab" onclick="showTab('errors')">Errors</button>
            ${data.apdexData.length > 0 ? '<button class="tab" onclick="showTab(\'apdex\')">APDEX</button>' : ''}
        </div>
        
        <div id="charts" class="tab-content active">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Response Times Over Time</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="responseTimeChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Throughput & Error Rate</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="throughputChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Response Time Distribution</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="distributionChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="statistics" class="tab-content">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Endpoint Statistics</h3>
                </div>
                <div class="panel-body">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Endpoint</th>
                                    <th class="text-right">Samples</th>
                                    <th class="text-right">Average</th>
                                    <th class="text-right">Median</th>
                                    <th class="text-right">90%</th>
                                    <th class="text-right">95%</th>
                                    <th class="text-right">99%</th>
                                    <th class="text-right">Min</th>
                                    <th class="text-right">Max</th>
                                    <th class="text-right">Error %</th>
                                    <th class="text-right">Throughput</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.endpointStats.map(stat => `
                                <tr>
                                    <td>${data.includeDrillDown ? `<a class="drill-down-link" onclick="showDrillDown('${escapeJavaScript(stat.label)}')">${escapeHtml(stat.label)}</a>` : escapeHtml(stat.label)}</td>
                                    <td class="text-right">${stat.samples.toLocaleString()}</td>
                                    <td class="text-right">${stat.average.toFixed(0)}ms</td>
                                    <td class="text-right">${stat.median.toFixed(0)}ms</td>
                                    <td class="text-right">${stat.p90.toFixed(0)}ms</td>
                                    <td class="text-right">${stat.p95.toFixed(0)}ms</td>
                                    <td class="text-right">${stat.p99.toFixed(0)}ms</td>
                                    <td class="text-right">${stat.min.toFixed(0)}ms</td>
                                    <td class="text-right">${stat.max.toFixed(0)}ms</td>
                                    <td class="text-right ${stat.errorRate < 0.01 ? 'success' : stat.errorRate < 0.05 ? 'warning' : 'error'}">
                                        ${(stat.errorRate * 100).toFixed(2)}%
                                    </td>
                                    <td class="text-right">${stat.throughput.toFixed(2)}/s</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="errors" class="tab-content">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Error Summary</h3>
                </div>
                <div class="panel-body">
                    ${data.errorSummary.length > 0 ? `
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Response Code</th>
                                    <th>Error Message</th>
                                    <th class="text-right">Count</th>
                                    <th class="text-right">Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.errorSummary.map(error => `
                                <tr>
                                    <td><span class="error">${error.responseCode}</span></td>
                                    <td>${escapeHtml(error.message)}</td>
                                    <td class="text-right">${error.count.toLocaleString()}</td>
                                    <td class="text-right">${error.percentage.toFixed(2)}%</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : '<p>No errors recorded during the test.</p>'}
                </div>
            </div>
        </div>
        
        ${data.apdexData.length > 0 ? `
        <div id="apdex" class="tab-content">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">APDEX Scores by Endpoint</h3>
                </div>
                <div class="panel-body">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Endpoint</th>
                                    <th class="text-center">APDEX Score</th>
                                    <th class="text-right">Satisfied</th>
                                    <th class="text-right">Tolerating</th>
                                    <th class="text-right">Frustrated</th>
                                    <th class="text-right">Total Samples</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.apdexData.map(apdex => `
                                <tr>
                                    <td>${escapeHtml(apdex.label)}</td>
                                    <td class="text-center">
                                        <span class="apdex-score ${getApdexClass(apdex.score)}">
                                            ${apdex.score.toFixed(3)}
                                        </span>
                                    </td>
                                    <td class="text-right">${apdex.satisfied.toLocaleString()}</td>
                                    <td class="text-right">${apdex.tolerating.toLocaleString()}</td>
                                    <td class="text-right">${apdex.frustrated.toLocaleString()}</td>
                                    <td class="text-right">${apdex.samples.toLocaleString()}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
    </div>
    
    ${data.includeDrillDown ? `
    <div id="drillDownModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeDrillDown()">&times;</span>
            <h2 id="drillDownTitle"></h2>
            <div id="drillDownContent"></div>
        </div>
    </div>
    ` : ''}
    
    <script>
        const isDark = ${isDark};
        const chartColors = {
            primary: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#6366f1',
            gray: isDark ? '#6b7280' : '#9ca3af'
        };
        
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#e5e7eb' : '#374151';
        
        // Time series data
        const timeSeriesData = ${safeJsonStringify(data.timeSeriesData)};
        const labels = timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString());
        
        // Response Time Chart
        const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
        new Chart(responseTimeCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Response Time',
                    data: timeSeriesData.map(d => d.responseTime),
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primary + '20',
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: textColor }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => context.parsed.y.toFixed(0) + 'ms'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { 
                            color: textColor,
                            callback: (value) => value + 'ms'
                        }
                    }
                }
            }
        });
        
        // Throughput & Error Rate Chart
        const throughputCtx = document.getElementById('throughputChart').getContext('2d');
        new Chart(throughputCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Throughput',
                    data: timeSeriesData.map(d => d.throughput),
                    borderColor: chartColors.success,
                    backgroundColor: chartColors.success + '20',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y'
                }, {
                    label: 'Error Rate',
                    data: timeSeriesData.map(d => d.errorRate * 100),
                    borderColor: chartColors.error,
                    backgroundColor: chartColors.error + '20',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: textColor }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: gridColor },
                        ticks: { 
                            color: textColor,
                            callback: (value) => value + '/s'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { 
                            color: textColor,
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
        
        // Response Time Distribution
        const allResponseTimes = ${safeJsonStringify(data.allRecords.map(r => r.elapsed))};
        const distributionCtx = document.getElementById('distributionChart').getContext('2d');
        
        // Create histogram data
        const bins = 50;
        const minTime = Math.min(...allResponseTimes);
        const maxTime = Math.max(...allResponseTimes);
        const binSize = (maxTime - minTime) / bins;
        const histogram = new Array(bins).fill(0);
        
        allResponseTimes.forEach(time => {
            const binIndex = Math.min(Math.floor((time - minTime) / binSize), bins - 1);
            histogram[binIndex]++;
        });
        
        const binLabels = histogram.map((_, i) => Math.round(minTime + i * binSize) + 'ms');
        
        new Chart(distributionCtx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Request Count',
                    data: histogram,
                    backgroundColor: chartColors.info + '80',
                    borderColor: chartColors.info,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { 
                            color: textColor,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    }
                }
            }
        });
        
        // Tab functionality
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }
        
        // APDEX class helper
        function getApdexClass(score) {
            if (score >= 0.94) return 'apdex-excellent';
            if (score >= 0.85) return 'apdex-good';
            if (score >= 0.70) return 'apdex-fair';
            return 'apdex-poor';
        }
        
        ${data.includeDrillDown ? `
        // Drill-down functionality
        const endpointData = ${safeJsonStringify(endpointDataForJs)};
        
        function showDrillDown(endpoint) {
            const modal = document.getElementById('drillDownModal');
            const title = document.getElementById('drillDownTitle');
            const content = document.getElementById('drillDownContent');
            
            title.textContent = 'Details: ' + endpoint;
            
            const records = endpointData[endpoint] || [];
            const responseTimes = records.map(r => r.elapsed);
            
            // Create drill-down chart
            content.innerHTML = \`
                <div class="panel">
                    <div class="panel-heading">
                        <h3 class="panel-title">Response Time Timeline</h3>
                    </div>
                    <div class="panel-body">
                        <div class="chart-container">
                            <canvas id="drillDownChart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="panel">
                    <div class="panel-heading">
                        <h3 class="panel-title">Sample Details (Last 100)</h3>
                    </div>
                    <div class="panel-body">
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Response Time</th>
                                        <th>Status</th>
                                        <th>Bytes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    \${records.slice(-100).reverse().map(r => \`
                                    <tr>
                                        <td>\${new Date(r.timestamp).toLocaleString()}</td>
                                        <td class="text-right">\${r.elapsed}ms</td>
                                        <td class="text-center">
                                            <span class="\${r.success ? 'success' : 'error'}">\${r.responseCode}</span>
                                        </td>
                                        <td class="text-right">\${(r.bytes / 1024).toFixed(2)} KB</td>
                                    </tr>
                                    \`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            \`;
            
            modal.style.display = 'block';
            
            // Create drill-down chart
            setTimeout(() => {
                const drillCtx = document.getElementById('drillDownChart').getContext('2d');
                new Chart(drillCtx, {
                    type: 'line',
                    data: {
                        labels: records.map(r => new Date(r.timestamp).toLocaleTimeString()),
                        datasets: [{
                            label: 'Response Time',
                            data: responseTimes,
                            borderColor: chartColors.primary,
                            backgroundColor: chartColors.primary + '20',
                            tension: 0.1,
                            pointRadius: 1,
                            pointHoverRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: {
                                grid: { color: gridColor },
                                ticks: { 
                                    color: textColor,
                                    maxTicksLimit: 10
                                }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { 
                                    color: textColor,
                                    callback: (value) => value + 'ms'
                                }
                            }
                        }
                    }
                });
            }, 100);
        }
        
        function closeDrillDown() {
            document.getElementById('drillDownModal').style.display = 'none';
        }
        
        window.onclick = function(event) {
            const modal = document.getElementById('drillDownModal');
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }
        ` : ''}
    </script>
</body>
</html>`;

  function getApdexClass(score: number): string {
    if (score >= 0.94) return 'success';
    if (score >= 0.85) return 'info';
    if (score >= 0.70) return 'warning';
    return 'error';
  }
}

/**
 * Express middleware for performance monitoring
 */
export interface MiddlewareOptions {
  includeQuery?: boolean
  skipPaths?: RegExp[]
  customLabels?: (req: any) => Record<string, any>
  collector?: JMeterPerformanceCollector
}

export function performanceMiddleware(
  collectorOrOptions: JMeterPerformanceCollector | MiddlewareOptions,
  options?: MiddlewareOptions
) {
  let collector: JMeterPerformanceCollector
  let middlewareOptions: MiddlewareOptions

  if (collectorOrOptions instanceof JMeterPerformanceCollector) {
    collector = collectorOrOptions
    middlewareOptions = options || {}
  } else {
    middlewareOptions = collectorOrOptions
    collector = middlewareOptions.collector!
  }

  return (req: any, res: any, next: any) => {
    // Skip if path matches skip patterns
    if (middlewareOptions.skipPaths) {
      const shouldSkip = middlewareOptions.skipPaths.some(pattern => 
        pattern.test(req.path)
      )
      if (shouldSkip) {
        return next()
      }
    }

    const startTime = Date.now()
    const startCpuUsage = process.cpuUsage()
    
    // Override res.end to capture response
    const originalEnd = res.end
    res.end = function(...args: any[]) {
      res.end = originalEnd
      res.end(...args)
      
      const responseTime = Date.now() - startTime
      const cpuUsage = process.cpuUsage(startCpuUsage)
      
      // Build endpoint label
      let endpoint = `${req.method} ${req.route?.path || req.path}`
      if (middlewareOptions.includeQuery && req.query && Object.keys(req.query).length > 0) {
        endpoint += '?' + new URLSearchParams(req.query).toString()
      }
      
      // Get custom labels if provided
      const customFields = middlewareOptions.customLabels ? 
        middlewareOptions.customLabels(req) : {}
      
      // Record metric
      collector.recordMetric({
        endpoint,
        responseTime,
        statusCode: res.statusCode,
        method: req.method,
        success: res.statusCode < 400,
        bytes: res.get('content-length') ? parseInt(res.get('content-length')) : 0,
        sentBytes: req.get('content-length') ? parseInt(req.get('content-length')) : 0,
        customFields: {
          ...customFields,
          cpuUser: cpuUsage.user,
          cpuSystem: cpuUsage.system,
          memoryUsage: process.memoryUsage().heapUsed
        }
      }).catch(err => console.error('Failed to record metric:', err))
    }
    
    next()
  }
}

// Export all functions and classes
export default {
  createCollector,
  generateJMeterReport,
  performanceMiddleware,
  JMeterPerformanceCollector,
  StatisticsCalculator
}