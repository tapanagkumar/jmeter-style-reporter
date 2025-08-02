/**
 * Enhanced JMeter Style Reporter
 * Provides comprehensive performance testing and reporting with JMeter compatibility
 */

import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'

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
  apiVersion?: '1.0' | '1.1' | 'latest'
  maxMemoryUsageMB?: number
  streamingMode?: boolean
  maxDataPoints?: number
  skipDataValidation?: boolean
  jenkinsCompatible?: boolean
  embeddedCharts?: boolean
  compareToPrevious?: boolean
  buildComparisonPath?: string
  generateXml?: boolean
  performanceThresholds?: {
    warningThreshold?: number // ms
    errorThreshold?: number // ms
    errorRateThreshold?: number // percentage (0-1)
  }
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
  warnings: string[]
  stats: {
    memoryUsedMB: number
    processingTimeMs: number
    recordsProcessed: number
    recordsSkipped: number
  }
  summaryJsonPath?: string
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
  previousAverage?: number
  averageDelta?: number
  performanceTrend?: 'improved' | 'degraded' | 'stable'
}

interface BuildComparisonData {
  buildNumber?: string
  timestamp: number
  endpoints: Record<string, {
    average: number
    samples: number
    errorRate: number
    throughput: number
  }>
  summary: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    throughput: number
  }
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
  private totalMetricsCollected: number = 0
  private totalMetricsFlushed: number = 0
  private errorCount: number = 0
  private flushCount: number = 0
  private readonly startTime: number = Date.now()
  private dataIntegrityHash: string = ''
  private cleanupListener?: () => void

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

    // Add cleanup on process exit with proper listener tracking
    this.cleanupListener = () => {
      if (!this.disposed) {
        this.dispose().catch(console.error)
      }
    }
    
    process.once('exit', this.cleanupListener)
    process.once('SIGINT', this.cleanupListener)
    process.once('SIGTERM', this.cleanupListener)
    process.once('uncaughtException', this.cleanupListener)
  }

  async recordMetric(metric: Partial<PerformanceMetric>): Promise<void> {
    if (this.disposed) {
      console.warn('Cannot record metric: collector has been disposed')
      return
    }

    try {
      // Enhanced validation
      if (metric.responseTime !== undefined && (typeof metric.responseTime !== 'number' || metric.responseTime < 0)) {
        throw new Error(`Invalid response time: ${metric.responseTime}`)
      }

      if (metric.statusCode !== undefined && (typeof metric.statusCode !== 'number' || metric.statusCode < 100 || metric.statusCode > 599)) {
        throw new Error(`Invalid status code: ${metric.statusCode}`)
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

      // Data integrity check
      this.updateDataIntegrityHash(fullMetric)
      
      this.metrics.push(fullMetric)
      this.totalMetricsCollected++

      if (this.metrics.length >= (this.options.bufferSize || 1000)) {
        await this.flush()
      }
    } catch (error) {
      this.errorCount++
      this.options.onError?.(error as Error)
      console.error('Failed to record metric:', error)
    }
  }

  private updateDataIntegrityHash(metric: PerformanceMetric): void {
    const metricString = `${metric.timestamp}:${metric.responseTime}:${metric.statusCode}`
    this.dataIntegrityHash = createHash('sha256').update(this.dataIntegrityHash + metricString).digest('hex').substring(0, 16)
  }

  getStats(): {
    totalMetrics: number
    bufferedMetrics: number
    flushCount: number
    errorCount: number
    isActive: boolean
    startTime: number
    lastFlushTime: number
    dataIntegrityHash: string
  } {
    return {
      totalMetrics: this.totalMetricsCollected,
      bufferedMetrics: this.metrics.length,
      flushCount: this.flushCount,
      errorCount: this.errorCount,
      isActive: !this.disposed,
      startTime: this.startTime,
      lastFlushTime: Date.now(),
      dataIntegrityHash: this.dataIntegrityHash
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
      this.totalMetricsFlushed += count
      this.flushCount++
      
      if (!this.options.silent) {
        console.log(`✅ Flushed ${count} metrics to ${this.options.outputPath} (Total: ${this.totalMetricsFlushed})`)
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

    // Remove specific event listeners to prevent memory leaks
    if (this.cleanupListener) {
      try {
        process.removeListener('exit', this.cleanupListener)
        process.removeListener('SIGINT', this.cleanupListener)
        process.removeListener('SIGTERM', this.cleanupListener)
        process.removeListener('uncaughtException', this.cleanupListener)
        this.cleanupListener = undefined
      } catch (error) {
        // Ignore errors if process cleanup fails
      }
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
 * Enhanced CSV parsing with better validation and error tracking
 */
interface ParseResult {
  record: JMeterRecord | null
  errors: string[]
  warnings: string[]
}

function parseCSVLineEnhanced(line: string, lineNumber: number): ParseResult {
  const result: ParseResult = {
    record: null,
    errors: [],
    warnings: []
  }

  if (!line || line.trim().length === 0) {
    return result
  }

  // Check for potential CSV injection
  if (/^[@=+\-|]/.test(line.trim())) {
    result.warnings.push(`Line ${lineNumber}: Potential CSV injection detected`)
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
        parts.push(sanitizeCSVField(current.trim()))
        current = ''
        i++
        continue
      } else {
        current += char
      }
      i++
    }

    // Add the last field
    parts.push(sanitizeCSVField(current.trim()))

    // Validate minimum field count
    if (parts.length < 10) {
      result.errors.push(`Line ${lineNumber}: Insufficient fields: ${parts.length} < 10`)
      return result
    }

    // Parse with enhanced validation
    const timestamp = parseIntSafe(parts[0])
    const elapsed = parseFloatSafe(parts[1])
    const responseCode = parseIntSafe(parts[3])

    // Validate required numeric fields
    if (isNaN(timestamp) || timestamp <= 0) {
      result.errors.push(`Line ${lineNumber}: Invalid timestamp: ${parts[0]}`)
      return result
    }

    if (isNaN(elapsed) || elapsed < 0) {
      result.errors.push(`Line ${lineNumber}: Invalid elapsed time: ${parts[1]}`)
      return result
    }

    if (isNaN(responseCode) || responseCode < 100 || responseCode > 599) {
      result.errors.push(`Line ${lineNumber}: Invalid response code: ${parts[3]}`)
      return result
    }

    // Validate timestamp is reasonable (not too old or in future)
    const now = Date.now()
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000)
    const oneHourFuture = now + (60 * 60 * 1000)
    
    if (timestamp < oneYearAgo || timestamp > oneHourFuture) {
      result.warnings.push(`Line ${lineNumber}: Suspicious timestamp: ${new Date(timestamp).toISOString()}`)
    }

    // Validate response time is reasonable
    if (elapsed > 300000) { // 5 minutes
      result.warnings.push(`Line ${lineNumber}: Very high response time: ${elapsed}ms`)
    }

    result.record = {
      timestamp,
      elapsed,
      label: sanitizeString(parts[2]),
      responseCode,
      success: parts[4]?.toLowerCase().trim() === 'true',
      bytes: Math.max(0, parseIntSafe(parts[5]) || 0),
      sentBytes: Math.max(0, parseIntSafe(parts[6]) || 0),
      grpThreads: Math.max(1, parseIntSafe(parts[7]) || 1),
      allThreads: Math.max(1, parseIntSafe(parts[8]) || 1),
      filename: sanitizeString(parts[9] || '')
    }

    return result
  } catch (error) {
    result.errors.push(`Line ${lineNumber}: Parse error: ${error}`)
    return result
  }
}

/**
 * Legacy function for backward compatibility
 */
function parseCSVLine(line: string): JMeterRecord | null {
  const result = parseCSVLineEnhanced(line, 0)
  if (result.errors.length > 0) {
    console.error('CSV parse errors:', result.errors)
  }
  if (result.warnings.length > 0) {
    console.warn('CSV parse warnings:', result.warnings)
  }
  return result.record
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
 * Enhanced security validation for file paths
 */
function validateOutputPath(outputPath: string): string {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('Invalid output path')
  }
  
  // Prevent path traversal attacks
  const resolved = path.resolve(outputPath)
  const cwd = process.cwd()
  
  if (!resolved.startsWith(cwd)) {
    throw new Error('Output path must be within current working directory')
  }
  
  // Prevent writing to system directories
  const forbidden = ['/etc', '/usr', '/var', '/bin', '/sbin', '/boot', '/sys']
  if (forbidden.some(dir => resolved.startsWith(dir))) {
    throw new Error('Cannot write to system directories')
  }
  
  return resolved
}

/**
 * Enhanced CSV injection prevention
 */
function sanitizeCSVField(value: string): string {
  if (!value) return ''
  
  // Remove formula injection patterns
  const dangerous = /^[@=+\-|]/
  if (dangerous.test(value.toString().trim())) {
    return `'${value}` // Prefix with quote to prevent formula execution
  }
  
  return value.toString()
    .replace(/[\r\n]/g, ' ') // Remove line breaks
    .substring(0, 1000) // Limit length
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
    return JSON.stringify(data, (_, value) => {
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
 * Legacy API support for v1.0 compatibility
 */
interface LegacyCollectorOptions {
  outputPath: string
  testName?: string
  bufferSize?: number
  flushInterval?: number
  silent?: boolean
  onFlush?: (count: number) => void
  onError?: (error: Error) => void
}

function migrateLegacyOptions(legacy: LegacyCollectorOptions): CollectorOptions {
  return {
    ...legacy,
    jmeterCompatible: true // Ensure backward compatibility
  }
}

/**
 * Create performance collector with enhanced features
 */
export function createCollector(options: CollectorOptions | LegacyCollectorOptions): JMeterPerformanceCollector {
  // Detect if using legacy options format
  const hasLegacyOnlyFields = 'jmeterCompatible' in options
  const enhancedOptions = hasLegacyOnlyFields ? options as CollectorOptions : migrateLegacyOptions(options as LegacyCollectorOptions)
  
  return new JMeterPerformanceCollector(enhancedOptions)
}

/**
 * Legacy function name for v1.0 compatibility
 */
export const generateReport = generateJMeterReport

/**
 * Jenkins Summary JSON structure for performance trend tracking
 */
interface JenkinsSummaryJson {
  statistic: {
    failed: number
    broken: number
    skipped: number
    passed: number
    unknown: number
    total: number
  }
  time: {
    start: number
    stop: number
    duration: number
  }
  performance?: {
    averageResponseTime: number
    throughput: number
    errorRate: number
    percentiles: {
      p50: number
      p90: number
      p95: number
      p99: number
    }
    apdexScore?: number
  }
}

/**
 * Load previous build comparison data
 */
async function loadPreviousBuildData(buildComparisonPath: string): Promise<BuildComparisonData | null> {
  try {
    const { promises: fsPromises } = await import('fs')
    const data = await fsPromises.readFile(buildComparisonPath, 'utf8')
    return JSON.parse(data) as BuildComparisonData
  } catch (error) {
    // Previous build data doesn't exist or is invalid
    return null
  }
}

/**
 * Save current build data for future comparisons
 */
async function saveBuildComparisonData(
  buildComparisonPath: string,
  endpointStats: EndpointStats[],
  summary: ReportResult['summary'],
  previousBuildData?: BuildComparisonData | null
): Promise<void> {
  try {
    const { promises: fsPromises } = await import('fs')
    const path = await import('path')
    
    // Ensure directory exists
    const dir = path.dirname(buildComparisonPath)
    await fsPromises.mkdir(dir, { recursive: true })
    
    // Generate build number based on previous build or environment
    let buildNumber = process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER
    if (!buildNumber) {
      // Use previous build data to increment build number
      if (previousBuildData && previousBuildData.buildNumber) {
        const prevBuildNum = typeof previousBuildData.buildNumber === 'string' ? 
          parseInt(previousBuildData.buildNumber) : previousBuildData.buildNumber
        buildNumber = String((prevBuildNum || 0) + 1)
      } else {
        buildNumber = '1'
      }
    }

    const buildData: BuildComparisonData = {
      buildNumber,
      timestamp: Date.now(),
      endpoints: {},
      summary: {
        totalRequests: summary.totalRequests,
        averageResponseTime: summary.averageResponseTime || 0,
        errorRate: summary.errorRate,
        throughput: summary.throughput
      }
    }
    
    // Store endpoint data for comparison
    endpointStats.forEach(stat => {
      buildData.endpoints[stat.label] = {
        average: stat.average,
        samples: stat.samples,
        errorRate: stat.errorRate,
        throughput: stat.throughput
      }
    })
    
    await fsPromises.writeFile(buildComparisonPath, JSON.stringify(buildData, null, 2), 'utf8')
    console.log(`💾 Saved build comparison data to: ${buildComparisonPath}`)
  } catch (error) {
    console.warn('⚠️  Failed to save build comparison data:', error)
  }
}

/**
 * Calculate performance deltas and trends
 */
function calculatePerformanceDeltas(
  currentStats: EndpointStats[],
  previousBuildData: BuildComparisonData | null
): EndpointStats[] {
  if (!previousBuildData) {
    return currentStats
  }
  
  return currentStats.map(stat => {
    const previousData = previousBuildData.endpoints[stat.label]
    if (!previousData) {
      return stat
    }
    
    const averageDelta = stat.average - previousData.average
    const deltaThreshold = previousData.average * 0.05 // 5% threshold for "stable"
    
    let performanceTrend: 'improved' | 'degraded' | 'stable'
    if (Math.abs(averageDelta) <= deltaThreshold) {
      performanceTrend = 'stable'
    } else if (averageDelta < 0) {
      performanceTrend = 'improved'
    } else {
      performanceTrend = 'degraded'
    }
    
    return {
      ...stat,
      previousAverage: previousData.average,
      averageDelta: averageDelta,
      performanceTrend: performanceTrend
    }
  })
}


// Removed unused getEndpointInsights function

/**
 * Generate JUnit XML for Jenkins test results integration
 */
function generateJUnitXml(
  endpointStats: EndpointStats[],
  summary: ReportResult['summary'],
  options: ReportOptions
): string {
  const thresholds = {
    warningThreshold: options.performanceThresholds?.warningThreshold || 300, // 300ms
    errorThreshold: options.performanceThresholds?.errorThreshold || 1000, // 1000ms
    errorRateThreshold: options.performanceThresholds?.errorRateThreshold || 0.05 // 5%
  }
  
  let totalTests = 0
  let totalFailures = 0
  let totalTime = 0
  
  const testsuites: string[] = []
  
  // Group endpoints by HTTP method for better organization
  const endpointsByMethod = new Map<string, EndpointStats[]>()
  endpointStats.forEach(stat => {
    const method = stat.label.split(' ')[0] || 'UNKNOWN'
    if (!endpointsByMethod.has(method)) {
      endpointsByMethod.set(method, [])
    }
    endpointsByMethod.get(method)!.push(stat)
  })
  
  for (const [method, endpoints] of endpointsByMethod) {
    const suiteTests = endpoints.length
    let suiteFailures = 0
    let suiteTime = 0
    const testcases: string[] = []
    
    endpoints.forEach(stat => {
      const endpointPath = stat.label.replace(`${method} `, '')
      const avgTimeSeconds = stat.average / 1000
      suiteTime += avgTimeSeconds
      totalTime += avgTimeSeconds
      
      let hasFailure = false
      let failureMessage = ''
      let failureDetails = ''
      
      // Check performance thresholds
      if (stat.average > thresholds.errorThreshold) {
        hasFailure = true
        failureMessage = `Average response time (${stat.average.toFixed(0)}ms) exceeded error threshold of ${thresholds.errorThreshold}ms.`
        failureDetails = `
          Endpoint: ${endpointPath}
          Metric: Average Response Time
          Value: ${stat.average.toFixed(0)}ms
          Threshold: ${thresholds.errorThreshold}ms
          Error Rate: ${(stat.errorRate * 100).toFixed(1)}%
          Samples: ${stat.samples}
        `
      } else if (stat.errorRate > thresholds.errorRateThreshold) {
        hasFailure = true
        failureMessage = `Error rate (${(stat.errorRate * 100).toFixed(1)}%) exceeded threshold of ${(thresholds.errorRateThreshold * 100).toFixed(1)}%.`
        failureDetails = `
          Endpoint: ${endpointPath}
          Metric: Error Rate
          Value: ${(stat.errorRate * 100).toFixed(1)}%
          Threshold: ${(thresholds.errorRateThreshold * 100).toFixed(1)}%
          Average Response Time: ${stat.average.toFixed(0)}ms
          Samples: ${stat.samples}
        `
      } else if (stat.average > thresholds.warningThreshold) {
        hasFailure = true
        failureMessage = `Average response time (${stat.average.toFixed(0)}ms) exceeded warning threshold of ${thresholds.warningThreshold}ms.`
        failureDetails = `
          Endpoint: ${endpointPath}
          Metric: Average Response Time
          Value: ${stat.average.toFixed(0)}ms
          Threshold: ${thresholds.warningThreshold}ms
          Error Rate: ${(stat.errorRate * 100).toFixed(1)}%
          Samples: ${stat.samples}
        `
      }
      
      if (hasFailure) {
        suiteFailures++
        totalFailures++
      }
      
      const testcase = `
    <testcase classname="${escapeXml(method)}" name="${escapeXml(endpointPath)}" time="${avgTimeSeconds.toFixed(3)}">
      ${hasFailure ? `<failure message="${escapeXml(failureMessage)}" type="PerformanceWarning">
        <![CDATA[${failureDetails.trim()}]]>
      </failure>` : `<!-- Healthy endpoint: ${stat.average.toFixed(0)}ms average, ${(stat.errorRate * 100).toFixed(1)}% error rate -->`}
    </testcase>`
      
      testcases.push(testcase)
    })
    
    totalTests += suiteTests
    
    const testsuite = `
  <testsuite name="${escapeXml(method)} Endpoints" tests="${suiteTests}" failures="${suiteFailures}" timestamp="${new Date().toISOString()}" time="${suiteTime.toFixed(3)}">
    ${testcases.join('')}
  </testsuite>`
    
    testsuites.push(testsuite)
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Performance Tests" tests="${totalTests}" failures="${totalFailures}" time="${totalTime.toFixed(3)}">
  ${testsuites.join('')}
</testsuites>`
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== 'string') {
    return ''
  }
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Remove control characters that are invalid in XML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Generate Jenkins dashboard performance badge HTML
 */
function generateJenkinsPerformanceBadge(
  summary: ReportResult['summary'],
  previousBuildData: BuildComparisonData | null
): string {
  const avgResponseTime = summary.averageResponseTime || 0
  const errorRate = (summary.errorRate || 0) * 100
  
  // Determine overall status
  let statusText = 'Healthy'
  let statusColor = '#10b981'
  
  if (avgResponseTime > 1000 || errorRate > 10) {
    statusText = 'Critical'
    statusColor = '#ef4444'
  } else if (avgResponseTime > 500 || errorRate > 5) {
    statusText = 'Warning'
    statusColor = '#f59e0b'
  }
  
  // Calculate trend vs previous build
  let trendIndicator = ''
  if (previousBuildData && previousBuildData.summary) {
    const prevAvg = previousBuildData.summary.averageResponseTime || 0
    const diff = avgResponseTime - prevAvg
    const percentChange = prevAvg > 0 ? ((diff / prevAvg) * 100) : 0
    
    if (Math.abs(percentChange) > 5) {
      if (diff < 0) {
        trendIndicator = `<span style="color: #10b981;">↓ ${Math.abs(diff).toFixed(0)}ms faster</span>`
      } else {
        trendIndicator = `<span style="color: #ef4444;">↑ ${diff.toFixed(0)}ms slower</span>`
      }
    } else {
      trendIndicator = `<span style="color: #6b7280;">→ stable</span>`
    }
  }
  
  return `
<div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 10px 0; font-family: system-ui, -apple-system, sans-serif;">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
    <h3 style="margin: 0; color: #1f2937; font-size: 16px;">API Performance</h3>
    <div style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
      ${statusText}
    </div>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 8px;">
    <div style="text-align: center;">
      <div style="color: #6b7280; font-size: 12px;">Avg Response</div>
      <div style="font-size: 20px; font-weight: 600; color: #1f2937;">${avgResponseTime.toFixed(0)}ms</div>
    </div>
    <div style="text-align: center;">
      <div style="color: #6b7280; font-size: 12px;">Error Rate</div>
      <div style="font-size: 20px; font-weight: 600; color: #1f2937;">${errorRate.toFixed(1)}%</div>
    </div>
    <div style="text-align: center;">
      <div style="color: #6b7280; font-size: 12px;">Requests</div>
      <div style="font-size: 20px; font-weight: 600; color: #1f2937;">${summary.totalRequests}</div>
    </div>
  </div>
  ${trendIndicator ? `<div style="text-align: center; font-size: 14px; margin-top: 8px;">${trendIndicator}</div>` : ''}
</div>`
}

/**
 * Generate Jenkins trend chart data for Performance Plugin
 */
function generateJenkinsTrendData(
  summary: ReportResult['summary'],
  previousBuildData: BuildComparisonData | null,
  buildNumber: string
): any {
  const currentData = {
    buildNumber: parseInt(buildNumber) || 1,
    timestamp: Date.now(),
    averageResponseTime: summary.averageResponseTime || 0,
    errorRate: (summary.errorRate || 0) * 100,
    throughput: summary.throughput || 0,
    totalRequests: summary.totalRequests || 0
  }
  
  let trendData = [currentData]
  
  // Add previous build data if available
  if (previousBuildData && previousBuildData.summary) {
    const prevBuildNum = parseInt(previousBuildData.buildNumber || '1') || (currentData.buildNumber - 1)
    trendData.unshift({
      buildNumber: prevBuildNum,
      timestamp: previousBuildData.timestamp || (Date.now() - 86400000), // 1 day ago fallback
      averageResponseTime: previousBuildData.summary.averageResponseTime || 0,
      errorRate: (previousBuildData.summary.errorRate || 0) * 100,
      throughput: previousBuildData.summary.throughput || 0,
      totalRequests: previousBuildData.summary.totalRequests || 0
    })
  }
  
  return {
    builds: trendData,
    latest: currentData
  }
}

/**
 * Generate Jenkins-compatible summary.json for build trend tracking
 */
function generateJenkinsSummaryJson(
  summary: ReportResult['summary'],
  allRecords: JMeterRecord[],
  testDuration: number
): JenkinsSummaryJson {
  const startTime = Math.min(...allRecords.map(r => r.timestamp))
  const endTime = Math.max(...allRecords.map(r => r.timestamp))
  
  const errorCount = allRecords.filter(r => !r.success).length
  const successCount = allRecords.filter(r => r.success).length
  
  const jenkinsSummary: JenkinsSummaryJson = {
    statistic: {
      failed: errorCount,
      broken: 0, // For API tests, we typically don't have "broken" status
      skipped: 0, // For API tests, we typically don't have "skipped" status
      passed: successCount,
      unknown: 0,
      total: allRecords.length
    },
    time: {
      start: startTime,
      stop: endTime,
      duration: Math.round(testDuration * 1000) // Convert to milliseconds
    }
  }
  
  // Add performance data for Jenkins Performance Plugin compatibility
  if (summary.averageResponseTime !== undefined) {
    jenkinsSummary.performance = {
      averageResponseTime: summary.averageResponseTime,
      throughput: summary.throughput,
      errorRate: summary.errorRate,
      percentiles: summary.percentiles || {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0
      },
      apdexScore: summary.apdexScore
    }
  }
  
  return jenkinsSummary
}

/**
 * Enhanced memory-safe streaming report generation
 */
export async function generateJMeterReport(options: ReportOptions): Promise<ReportResult> {
  const processingStartTime = performance.now()
  const csvFiles = Array.isArray(options.csv) ? options.csv : [options.csv]
  const outputDir = validateOutputPath(options.output || './jmeter-report')
  
  // Configuration with backward compatibility
  const config = {
    apiVersion: options.apiVersion || 'latest',
    maxMemoryUsageMB: options.maxMemoryUsageMB || 512,
    streamingMode: options.streamingMode !== false,
    maxDataPoints: options.maxDataPoints || 10000,
    skipValidation: options.skipDataValidation === true
  }
  
  const warnings: string[] = []
  let recordsProcessed = 0
  let recordsSkipped = 0
  
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

  // Memory-efficient data processing
  const maxRecordsInMemory = Math.min(
    Math.floor((config.maxMemoryUsageMB * 1024 * 1024) / 256), // Assume ~256 bytes per record
    50000 // Hard limit for safety
  )
  
  const allRecords: JMeterRecord[] = []
  const parseErrors: string[] = []
  const parseWarnings: string[] = []
  
  for (const csvFile of csvFiles) {
    try {
      await fsPromises.access(csvFile)
      
      const fileStats = await fsPromises.stat(csvFile)
      if (fileStats.size > 500 * 1024 * 1024) { // 500MB
        warnings.push(`Large file detected: ${csvFile} (${Math.round(fileStats.size / 1024 / 1024)}MB)`)
      }
      
      const fileStream = createReadStream(csvFile, { 
        encoding: 'utf8',
        highWaterMark: 64 * 1024 // 64KB chunks
      })
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })

      let lineNumber = 0
      let fileRecordCount = 0

      for await (const line of rl) {
        lineNumber++
        
        // Skip header line
        if (lineNumber === 1) {
          continue
        }

        if (line.trim()) {
          if (!config.skipValidation) {
            const parseResult = parseCSVLineEnhanced(line, lineNumber)
            parseErrors.push(...parseResult.errors)
            parseWarnings.push(...parseResult.warnings)
            
            if (parseResult.record) {
              allRecords.push(parseResult.record)
              recordsProcessed++
              fileRecordCount++
            } else {
              recordsSkipped++
            }
          } else {
            // Fast parsing without validation for large files
            const record = parseCSVLine(line)
            if (record) {
              allRecords.push(record)
              recordsProcessed++
              fileRecordCount++
            } else {
              recordsSkipped++
            }
          }

          // Memory safety check
          if (allRecords.length >= maxRecordsInMemory) {
            warnings.push(`Memory limit reached. Processed ${recordsProcessed} records, truncating remaining data.`)
            break
          }
        }
      }

      rl.close()
      fileStream.destroy()
      
      if (fileRecordCount === 0) {
        warnings.push(`No valid records found in ${csvFile}`)
      }
      
    } catch (error) {
      const message = `Could not process CSV file ${csvFile}: ${error}`
      warnings.push(message)
      console.warn(message)
    }
  }

  if (allRecords.length === 0) {
    throw new Error('No valid data found in CSV files. Check file format and data validity.')
  }

  // Report parsing issues
  if (parseErrors.length > 0) {
    warnings.push(`${parseErrors.length} parsing errors encountered`)
    if (parseErrors.length > 10) {
      console.error('First 10 parsing errors:', parseErrors.slice(0, 10))
    } else {
      console.error('Parsing errors:', parseErrors)
    }
  }

  if (parseWarnings.length > 0 && !config.skipValidation) {
    warnings.push(`${parseWarnings.length} parsing warnings`)
    console.warn(`${parseWarnings.length} parsing warnings (run with skipDataValidation: true to suppress)`)
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

  // Load previous build data for comparison if enabled
  let previousBuildData: BuildComparisonData | null = null
  if (options.compareToPrevious !== false) {
    const buildComparisonPath = options.buildComparisonPath || 
      path.join(outputDir, '.build-comparison.json')
    previousBuildData = await loadPreviousBuildData(buildComparisonPath)
  }

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

  // Apply performance deltas if previous build data exists
  const endpointStatsWithDeltas = calculatePerformanceDeltas(endpointStats, previousBuildData)

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

  // Generate the HTML report with build comparison data
  const htmlContent = generateEnhancedHTMLReport({
    title: options.title || 'JMeter Performance Dashboard',
    theme: options.theme || 'light',
    summary,
    endpointStats: endpointStatsWithDeltas, // Use stats with build comparison deltas
    timeSeriesData,
    errorSummary,
    apdexData,
    testDuration,
    allRecords,
    endpointData,
    includeDrillDown: options.includeDrillDown !== false,
    jenkinsCompatible: options.jenkinsCompatible,
    embeddedCharts: options.embeddedCharts,
    compareToPrevious: options.compareToPrevious !== false && previousBuildData !== null
  })

  const reportPath = path.join(outputDir, 'index.html')
  await fsPromises.writeFile(reportPath, htmlContent, 'utf8')

  // Generate Jenkins-compatible summary.json for build trend tracking
  let summaryJsonPath: string | undefined
  if (options.jenkinsCompatible !== false) {
    const jenkinsSummary = generateJenkinsSummaryJson(summary, allRecords, testDuration)
    
    // Create allure-report/widgets directory structure for Jenkins compatibility
    const allureWidgetsDir = path.join(outputDir, 'allure-report', 'widgets')
    await fsPromises.mkdir(allureWidgetsDir, { recursive: true })
    
    summaryJsonPath = path.join(allureWidgetsDir, 'summary.json')
    await fsPromises.writeFile(summaryJsonPath, JSON.stringify(jenkinsSummary, null, 2), 'utf8')
    
    // Generate Jenkins dashboard performance badge for build page display
    const buildNumber = process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || '1'
    const performanceBadge = generateJenkinsPerformanceBadge(summary, previousBuildData)
    const badgePath = path.join(outputDir, 'jenkins-performance-badge.html')
    await fsPromises.writeFile(badgePath, performanceBadge, 'utf8')
    
    // Generate Jenkins trend data for Performance Plugin
    const trendData = generateJenkinsTrendData(summary, previousBuildData, buildNumber)
    const trendPath = path.join(allureWidgetsDir, 'trend.json')
    await fsPromises.writeFile(trendPath, JSON.stringify(trendData, null, 2), 'utf8')
    
    console.log(`📊 Generated Jenkins summary.json at: ${summaryJsonPath}`)
    console.log(`🎯 Generated Jenkins dashboard badge at: ${badgePath}`)
    console.log(`📈 Performance metrics: ${summary.totalRequests} requests, ${(summary.errorRate * 100).toFixed(2)}% error rate, ${summary.averageResponseTime?.toFixed(0)}ms avg response time`)
  }

  // Generate JUnit XML for Jenkins test results integration
  if (options.generateXml !== false) {
    const xmlContent = generateJUnitXml(endpointStatsWithDeltas, summary, options)
    const xmlPath = path.join(outputDir, 'performance-results.xml')
    await fsPromises.writeFile(xmlPath, xmlContent, 'utf8')
    
    const thresholds = options.performanceThresholds || {}
    const warningThreshold = thresholds.warningThreshold || 300
    const errorThreshold = thresholds.errorThreshold || 1000
    const errorRateThreshold = thresholds.errorRateThreshold || 0.05
    
    console.log(`📄 Generated JUnit XML at: ${xmlPath}`)
    console.log(`⚙️  Performance thresholds: Warning: ${warningThreshold}ms, Error: ${errorThreshold}ms, Error Rate: ${(errorRateThreshold * 100)}%`)
  }

  // Save current build data for future comparisons
  if (options.compareToPrevious !== false) {
    // Always save to output directory, regardless of where we read from
    const saveComparisonPath = path.join(outputDir, '.build-comparison.json')
    await saveBuildComparisonData(saveComparisonPath, endpointStatsWithDeltas, summary, previousBuildData)
  }

  const processingEndTime = performance.now()
  const memoryUsage = process.memoryUsage()

  return {
    outputPath: outputDir,
    reportUrl: `file://${path.resolve(reportPath)}`,
    summary,
    warnings,
    stats: {
      memoryUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      processingTimeMs: Math.round(processingEndTime - processingStartTime),
      recordsProcessed,
      recordsSkipped
    },
    summaryJsonPath
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
  jenkinsCompatible?: boolean
  embeddedCharts?: boolean
  compareToPrevious?: boolean
}

/**
 * Get the appropriate charting library based on Jenkins compatibility
 */
function getEmbeddedChartingLibrary(): string {
  // Use Chart.js CDN as proven to work in Jenkins by user's implementation
  return `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`;
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

  const useEmbeddedCharts = data.jenkinsCompatible || data.embeddedCharts

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(data.title)}</title>
    ${useEmbeddedCharts ? getEmbeddedChartingLibrary() : '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'}
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
        
        ${data.compareToPrevious ? `
        .trend-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }
        
        .trend-indicator.improved {
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
        }
        
        .trend-indicator.degraded {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
        }
        
        .trend-indicator.stable {
            background: rgba(107, 114, 128, 0.1);
            color: #6b7280;
        }
        ` : ''}
        
        .text-muted {
            color: #9ca3af;
        }
        
        /* Drill-down table improvements */
        .drill-down-table {
            table-layout: fixed;
            width: 100%;
        }
        
        .drill-down-table th,
        .drill-down-table td {
            padding: 8px 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .drill-down-table td:first-child {
            white-space: normal;
            word-break: break-word;
        }
        
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
                                    ${data.compareToPrevious ? '<th class="text-right">Trend</th>' : ''}
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
                                    ${data.compareToPrevious ? `
                                    <td class="text-right">
                                        ${stat.averageDelta !== undefined ? `
                                            <span class="trend-indicator ${stat.performanceTrend}" title="vs previous: ${stat.averageDelta > 0 ? '+' : ''}${stat.averageDelta.toFixed(0)}ms">
                                                ${stat.performanceTrend === 'improved' ? '↓' : stat.performanceTrend === 'degraded' ? '↑' : '→'}
                                                ${stat.averageDelta > 0 ? '+' : ''}${stat.averageDelta.toFixed(0)}ms
                                            </span>
                                        ` : '<span class="text-muted">-</span>'}
                                    </td>
                                    ` : ''}
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
                            <table class="drill-down-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40%;">Timestamp</th>
                                        <th class="text-right" style="width: 20%;">Response Time</th>
                                        <th class="text-center" style="width: 20%;">Status</th>
                                        <th class="text-right" style="width: 20%;">Bytes</th>
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