/**
 * JMeter Style Reporter - Main Entry Point
 * A unified performance testing and reporting system
 */

export interface PerformanceMetric {
  endpoint?: string
  responseTime?: number
  statusCode?: number
  method?: string
  timestamp?: number
  success?: boolean
  testName?: string
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
}

export interface ReportOptions {
  csv: string | string[]
  output?: string
  title?: string
  theme?: 'light' | 'dark' | 'auto'
}

export interface ReportResult {
  outputPath: string
  reportUrl: string
  summary: {
    totalRequests: number
    averageResponseTime?: number
    errorRate: number
    throughput: number
  }
}

/**
 * Simple Performance Collector Implementation
 */
export class PerformanceCollector {
  private metrics: PerformanceMetric[] = []
  private options: CollectorOptions

  constructor(options: CollectorOptions) {
    this.options = {
      bufferSize: 1000,
      flushInterval: 5000,
      silent: false,
      ...options
    }
  }

  async recordMetric(metric: Partial<PerformanceMetric>): Promise<void> {
    const fullMetric: PerformanceMetric = {
      timestamp: Date.now(),
      endpoint: metric.endpoint || 'unknown',
      responseTime: metric.responseTime || 0,
      statusCode: metric.statusCode || 200,
      method: metric.method || 'GET',
      success: (metric.statusCode || 200) < 400,
      testName: metric.testName || this.options.testName || 'default',
      ...metric
    }

    this.metrics.push(fullMetric)

    if (this.metrics.length >= (this.options.bufferSize || 1000)) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) return

    const fs = await import('fs')
    const path = await import('path')
    
    // Ensure directory exists
    const dir = path.dirname(this.options.outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Create CSV header if file doesn't exist
    const fileExists = fs.existsSync(this.options.outputPath)
    if (!fileExists) {
      const header = 'timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename\n'
      fs.writeFileSync(this.options.outputPath, header)
    }

    // Write metrics to CSV
    const csvLines = this.metrics.map(metric => {
      return [
        metric.timestamp,
        metric.responseTime,
        `"${metric.endpoint}"`,
        metric.statusCode,
        metric.success,
        0, // bytes
        0, // sentBytes
        1, // grpThreads
        1, // allThreads
        `"${metric.testName}"`
      ].join(',')
    }).join('\n') + '\n'

    fs.appendFileSync(this.options.outputPath, csvLines)
    
    const count = this.metrics.length
    this.metrics = []
    
    if (!this.options.silent) {
      console.log(`✅ Flushed ${count} metrics to ${this.options.outputPath}`)
    }
    
    this.options.onFlush?.(count)
  }

  async dispose(): Promise<void> {
    await this.flush()
  }
}

/**
 * Create a performance collector
 */
export function createCollector(options: CollectorOptions): PerformanceCollector {
  return new PerformanceCollector(options)
}

// Data processing interfaces
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
}

interface TimeSeriesPoint {
  timestamp: number
  responseTime: number
  throughput: number
  errorRate: number
}

interface ErrorInfo {
  responseCode: number
  count: number
  percentage: number
  message: string
}

// Utility functions for statistical calculations
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function calculateApdexScore(responseTimes: number[], threshold: number = 500): number {
  if (responseTimes.length === 0) return 0
  const satisfied = responseTimes.filter(rt => rt <= threshold).length
  const tolerating = responseTimes.filter(rt => rt > threshold && rt <= threshold * 4).length
  return (satisfied + (tolerating * 0.5)) / responseTimes.length
}

function parseCSVLine(line: string): JMeterRecord | null {
  try {
    // Handle CSV parsing with quoted fields
    const parts = line.split(',')
    if (parts.length < 10) return null
    
    return {
      timestamp: parseInt(parts[0]),
      elapsed: parseFloat(parts[1]),
      label: parts[2].replace(/"/g, ''),
      responseCode: parseInt(parts[3]),
      success: parts[4] === 'true',
      bytes: parseInt(parts[5]) || 0,
      sentBytes: parseInt(parts[6]) || 0,
      grpThreads: parseInt(parts[7]) || 1,
      allThreads: parseInt(parts[8]) || 1,
      filename: parts[9] ? parts[9].replace(/"/g, '') : ''
    }
  } catch (error) {
    return null
  }
}

/**
 * Enhanced JMeter-style report generator with comprehensive dashboard
 */
export async function generateReport(options: ReportOptions): Promise<ReportResult> {
  const fs = await import('fs')
  const path = await import('path')
  
  const csvFiles = Array.isArray(options.csv) ? options.csv : [options.csv]
  const outputDir = options.output || './jmeter-report'
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Parse all CSV data
  const allRecords: JMeterRecord[] = []
  
  for (const csvFile of csvFiles) {
    if (fs.existsSync(csvFile)) {
      try {
        const content = fs.readFileSync(csvFile, 'utf8')
        const lines = content.split('\n').slice(1) // Skip header
        
        for (const line of lines) {
          if (line.trim()) {
            const record = parseCSVLine(line)
            if (record) {
              allRecords.push(record)
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not parse CSV file ${csvFile}:`, error)
      }
    }
  }

  if (allRecords.length === 0) {
    throw new Error('No valid data found in CSV files')
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
  for (const [label, records] of endpointData) {
    const responseTimes = records.map(r => r.elapsed)
    const errors = records.filter(r => !r.success).length
    const totalBytes = records.reduce((sum, r) => sum + r.bytes, 0)
    
    endpointStats.push({
      label,
      samples: records.length,
      average: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      median: calculatePercentile(responseTimes, 50),
      p90: calculatePercentile(responseTimes, 90),
      p95: calculatePercentile(responseTimes, 95),
      p99: calculatePercentile(responseTimes, 99),
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      errorRate: errors / records.length,
      throughput: records.length / Math.max(testDuration, 1),
      receivedKB: totalBytes / 1024,
      avgBytes: totalBytes / records.length
    })
  }

  // Calculate time series data for charts (group by time intervals)
  const timeInterval = Math.max(Math.floor(testDuration / 100), 1) * 1000 // milliseconds
  const timeSeriesData: TimeSeriesPoint[] = []
  
  for (let t = startTime; t <= endTime; t += timeInterval) {
    const windowRecords = allRecords.filter(r => r.timestamp >= t && r.timestamp < t + timeInterval)
    if (windowRecords.length > 0) {
      const avgResponseTime = windowRecords.reduce((sum, r) => sum + r.elapsed, 0) / windowRecords.length
      const errors = windowRecords.filter(r => !r.success).length
      
      timeSeriesData.push({
        timestamp: t,
        responseTime: avgResponseTime,
        throughput: windowRecords.length / (timeInterval / 1000),
        errorRate: errors / windowRecords.length
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
  const averageResponseTime = allRecords.reduce((sum, r) => sum + r.elapsed, 0) / totalRequests
  const errorRate = errorCount / totalRequests
  const throughput = totalRequests / Math.max(testDuration, 1)

  // Generate the Jenkins-compatible HTML report with embedded resources and drill-down
  const htmlContent = generateJenkinsCompatibleHTML({
    title: options.title || 'JMeter Performance Dashboard',
    theme: options.theme || 'light',
    summary: {
      totalRequests,
      averageResponseTime,
      errorRate,
      throughput,
      testDuration
    },
    endpointStats,
    timeSeriesData,
    errorSummary,
    apdexScores: endpointStats.map(stat => ({
      label: stat.label,
      score: calculateApdexScore(
        endpointData.get(stat.label)!.map(r => r.elapsed)
      ),
      samples: stat.samples
    })),
    allRecords,
    endpointData
  })

  const reportPath = path.join(outputDir, 'index.html')
  fs.writeFileSync(reportPath, htmlContent)

  return {
    outputPath: outputDir,
    reportUrl: `file://${path.resolve(reportPath)}`,
    summary: {
      totalRequests,
      averageResponseTime,
      errorRate,
      throughput
    }
  }
}

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

interface DashboardData {
  title: string
  theme: string
  summary: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    throughput: number
    testDuration: number
  }
  endpointStats: EndpointStats[]
  timeSeriesData: TimeSeriesPoint[]
  errorSummary: ErrorInfo[]
  apdexScores: Array<{label: string, score: number, samples: number}>
}

interface JenkinsCompatibleData extends DashboardData {
  allRecords: JMeterRecord[]
  endpointData: Map<string, JMeterRecord[]>
}

function generateDashboardHTML(data: DashboardData): string {
  const isDark = data.theme === 'dark'
  const bgColor = isDark ? '#1a1a1a' : '#f8f9fa'
  const cardBg = isDark ? '#2d3748' : '#ffffff'
  const textColor = isDark ? '#e2e8f0' : '#2d3748'
  const borderColor = isDark ? '#4a5568' : '#e2e8f0'

  // Get Chart.js minified code
  const chartJsCode = getEmbeddedChartJs()
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: ${bgColor};
            color: ${textColor};
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px 0;
            background: ${cardBg};
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            color: #3182ce;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.8;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .summary-card {
            background: ${cardBg};
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid ${borderColor};
            text-align: center;
            position: relative;
        }
        
        .summary-icon {
            font-size: 2rem;
            position: absolute;
            top: 15px;
            right: 20px;
            opacity: 0.3;
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
        
        .success { color: #38a169; }
        .warning { color: #d69e2e; }
        .error { color: #e53e3e; }
        .info { color: #3182ce; }
        
        .section {
            background: ${cardBg};
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid ${borderColor};
            margin-bottom: 30px;
            overflow: hidden;
        }
        
        .section-header {
            padding: 20px 25px;
            border-bottom: 1px solid ${borderColor};
            background: ${isDark ? '#374151' : '#f7fafc'};
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .section-header h2 {
            font-size: 1.5rem;
            margin: 0;
        }
        
        .section-content {
            padding: 25px;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
            margin: 15px 0;
            border: 1px solid ${borderColor};
            background: white;
        }
        
        .table-responsive {
            overflow-x: auto;
        }
        
        .stats-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        
        .stats-table th,
        .stats-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid ${borderColor};
        }
        
        .stats-table th {
            background: ${isDark ? '#374151' : '#f7fafc'};
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 0.5px;
        }
        
        .stats-table tr:hover {
            background: ${isDark ? '#2d3748' : '#f7fafc'};
        }
        
        .clickable-endpoint {
            cursor: pointer;
            color: #3182ce;
            text-decoration: underline;
            transition: color 0.2s;
        }
        
        .clickable-endpoint:hover {
            color: #2c5aa0;
        }
        
        .number {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        }
        
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .grid-3 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }
        
        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
        }
        
        .modal-content {
            background-color: ${cardBg};
            margin: 2% auto;
            padding: 0;
            border-radius: 12px;
            width: 90%;
            max-width: 1200px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            position: relative;
        }
        
        .modal-header {
            padding: 20px 30px;
            border-bottom: 1px solid ${borderColor};
            background: ${isDark ? '#374151' : '#f7fafc'};
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header h2 {
            margin: 0;
            color: #3182ce;
        }
        
        .close {
            background: none;
            border: none;
            font-size: 2rem;
            cursor: pointer;
            color: ${textColor};
            padding: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: background-color 0.2s;
        }
        
        .close:hover {
            background-color: ${isDark ? '#4a5568' : '#e2e8f0'};
        }
        
        .modal-body {
            padding: 30px;
        }
        
        .endpoint-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .endpoint-stat-card {
            background: ${isDark ? '#374151' : '#f7fafc'};
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid ${borderColor};
        }
        
        .endpoint-stat-value {
            font-size: 1.8rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .endpoint-stat-label {
            font-size: 0.8rem;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        @media (max-width: 768px) {
            .grid-2, .grid-3 {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 15px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .modal-content {
                width: 95%;
                margin: 5% auto;
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .endpoint-stats-grid {
                grid-template-columns: 1fr 1fr;
            }
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding: 20px;
            opacity: 0.6;
            font-size: 0.9rem;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            opacity: 0.6;
        }
        
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid ${borderColor};
            border-radius: 50%;
            border-top-color: #3182ce;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ${data.title}</h1>
            <p>Comprehensive Performance Analysis Dashboard</p>
            <p>⏱️ Test Duration: ${(data.summary.testDuration / 60).toFixed(1)} minutes | 📅 Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-icon">📈</div>
                <div class="summary-value info number">${data.summary.totalRequests.toLocaleString()}</div>
                <div class="summary-label">Total Requests</div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">⚡</div>
                <div class="summary-value ${data.summary.averageResponseTime > 1000 ? 'warning' : data.summary.averageResponseTime > 2000 ? 'error' : 'success'} number">
                    ${data.summary.averageResponseTime.toFixed(0)}ms
                </div>
                <div class="summary-label">Average Response Time</div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">🎯</div>
                <div class="summary-value ${data.summary.errorRate > 0.05 ? 'error' : data.summary.errorRate > 0.01 ? 'warning' : 'success'} number">
                    ${(data.summary.errorRate * 100).toFixed(2)}%
                </div>
                <div class="summary-label">Error Rate</div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">🚀</div>
                <div class="summary-value info number">${data.summary.throughput.toFixed(1)}</div>
                <div class="summary-label">Requests/Second</div>
            </div>
        </div>
        
        <div class="grid-2">
            <div class="panel">
                <div class="panel-heading">
                    <span>📈</span>
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
                    <span>🚀</span>
                    <h3 class="panel-title">Throughput Over Time</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="throughputChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid-2">
            <div class="panel">
                <div class="panel-heading">
                    <span>✅</span>
                    <h3 class="panel-title">Request Summary</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="successChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-heading">
                    <span>📊</span>
                    <h3 class="panel-title">Response Time Percentiles</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="percentilesChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="panel">
            <div class="panel-heading">
                <span>📋</span>
                <h3 class="panel-title">Statistics Table</h3>
            </div>
            <div class="panel-body">
                <div class="table-responsive">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Label</th>
                                <th>Samples</th>
                                <th>Average</th>
                                <th>Median</th>
                                <th>90th %ile</th>
                                <th>95th %ile</th>
                                <th>99th %ile</th>
                                <th>Min</th>
                                <th>Max</th>
                                <th>Error %</th>
                                <th>Throughput</th>
                                <th>Received KB/sec</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.endpointStats.map((stat, index) => `
                                <tr>
                                    <td><strong><span class="clickable-endpoint" onclick="openEndpointModal('${stat.label.replace(/'/g, "\\'")}', ${index})">${stat.label}</span></strong></td>
                                    <td class="number">${stat.samples.toLocaleString()}</td>
                                    <td class="number">${stat.average.toFixed(0)}ms</td>
                                    <td class="number">${stat.median.toFixed(0)}ms</td>
                                    <td class="number">${stat.p90.toFixed(0)}ms</td>
                                    <td class="number">${stat.p95.toFixed(0)}ms</td>
                                    <td class="number">${stat.p99.toFixed(0)}ms</td>
                                    <td class="number">${stat.min.toFixed(0)}ms</td>
                                    <td class="number">${stat.max.toFixed(0)}ms</td>
                                    <td class="number ${stat.errorRate > 0.05 ? 'error' : stat.errorRate > 0.01 ? 'warning' : 'success'}">
                                        ${(stat.errorRate * 100).toFixed(2)}%
                                    </td>
                                    <td class="number">${stat.throughput.toFixed(2)}/sec</td>
                                    <td class="number">${(stat.receivedKB / data.summary.testDuration).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        ${data.errorSummary.length > 0 ? `
        <div class="panel">
            <div class="panel-heading">
                <span>⚠️</span>
                <h3 class="panel-title">Error Summary</h3>
            </div>
            <div class="panel-body">
                <div class="table-responsive">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Response Code</th>
                                <th>Error Message</th>
                                <th>Count</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.errorSummary.map(error => `
                                <tr>
                                    <td class="number error"><strong>${error.responseCode}</strong></td>
                                    <td>${error.message}</td>
                                    <td class="number">${error.count.toLocaleString()}</td>
                                    <td class="number">${error.percentage.toFixed(2)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="panel">
            <div class="panel-heading">
                <span>🎯</span>
                <h3 class="panel-title">APDEX Table</h3>
            </div>
            <div class="panel-body">
                <p style="margin-bottom: 20px; opacity: 0.8;">
                    📊 Application Performance Index (APDEX) - Threshold: 500ms, Tolerance: 2000ms
                </p>
                <div class="table-responsive">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Label</th>
                                <th>Samples</th>
                                <th>APDEX Score</th>
                                <th>Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.apdexScores.map((apdex, index) => {
                                const rating = apdex.score >= 0.94 ? 'Excellent' : 
                                              apdex.score >= 0.85 ? 'Good' : 
                                              apdex.score >= 0.70 ? 'Fair' : 
                                              apdex.score >= 0.50 ? 'Poor' : 'Unacceptable'
                                const ratingClass = apdex.score >= 0.85 ? 'success' : 
                                                   apdex.score >= 0.70 ? 'warning' : 'error'
                                const ratingIcon = apdex.score >= 0.94 ? '🟢' :
                                                  apdex.score >= 0.85 ? '🟡' :
                                                  apdex.score >= 0.70 ? '🟠' : '🔴'
                                return `
                                    <tr>
                                        <td><strong><span class="clickable-endpoint" onclick="openEndpointModal('${apdex.label.replace(/'/g, "\\'")}', ${index})">${apdex.label}</span></strong></td>
                                        <td class="number">${apdex.samples.toLocaleString()}</td>
                                        <td class="number">${apdex.score.toFixed(3)}</td>
                                        <td class="${ratingClass}"><strong>${ratingIcon} ${rating}</strong></td>
                                    </tr>
                                `
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="footer">
            Generated by JMeter Style Reporter v2.0 | 🤖 Jenkins Compatible | ${new Date().toISOString()}
        </div>
    </div>

    <!-- Endpoint Detail Modal -->
    <div id="endpointModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">📊 Endpoint Analysis</h2>
                <button class="close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="loading" id="modalLoading">
                    <div class="spinner"></div>
                    <p>Loading endpoint details...</p>
                </div>
                <div id="modalContent" style="display: none;">
                    <div class="endpoint-stats-grid" id="endpointStatsGrid">
                        <!-- Stats will be populated by JavaScript -->
                    </div>
                    <div class="panel">
                        <div class="panel-heading">
                            <span>📈</span>
                            <h3>Response Time Distribution</h3>
                        </div>
                        <div class="panel-body">
                            <div class="chart-container">
                                <canvas id="endpointChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="panel">
                        <div class="panel-heading">
                            <span>📊</span>
                            <h3>Performance Metrics</h3>
                        </div>
                        <div class="panel-body">
                            <div class="chart-container">
                                <canvas id="endpointMetricsChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Embedded Chart.js Library -->
    <script>
        ${chartJsCode}
    </script>

    <script>
        // Global data for endpoints
        const endpointStats = ${JSON.stringify(data.endpointStats)};
        const timeSeriesData = ${JSON.stringify(data.timeSeriesData)};
        
        // JMeter Chart configuration
        Chart.defaults.color = '#4d4d4d';
        Chart.defaults.borderColor = '#ddd';
        Chart.defaults.backgroundColor = '#fff';
        Chart.defaults.lineColor = '#0088cc';
        Chart.defaults.gridColor = '#e0e0e0';

        // Modal functionality
        let currentEndpointChart = null;
        let currentEndpointMetricsChart = null;

        function openEndpointModal(endpointLabel, index) {
            const modal = document.getElementById('endpointModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalLoading = document.getElementById('modalLoading');
            const modalContent = document.getElementById('modalContent');
            
            modal.style.display = 'block';
            modalTitle.textContent = '📊 ' + endpointLabel;
            modalLoading.style.display = 'block';
            modalContent.style.display = 'none';
            
            // Simulate loading delay for better UX
            setTimeout(() => {
                loadEndpointDetails(endpointLabel, index);
                modalLoading.style.display = 'none';
                modalContent.style.display = 'block';
            }, 300);
        }

        function closeModal() {
            const modal = document.getElementById('endpointModal');
            modal.style.display = 'none';
            
            // Destroy existing charts to prevent memory leaks
            if (currentEndpointChart) {
                currentEndpointChart.destroy();
                currentEndpointChart = null;
            }
            if (currentEndpointMetricsChart) {
                currentEndpointMetricsChart.destroy();
                currentEndpointMetricsChart = null;
            }
        }

        function loadEndpointDetails(endpointLabel, index) {
            const stat = endpointStats[index];
            const statsGrid = document.getElementById('endpointStatsGrid');
            
            // Populate stats grid
            statsGrid.innerHTML = \`
                <div class="endpoint-stat-card">
                    <div class="endpoint-stat-value info number">\${stat.samples.toLocaleString()}</div>
                    <div class="endpoint-stat-label">📊 Samples</div>
                </div>
                <div class="endpoint-stat-card">
                    <div class="endpoint-stat-value \${stat.average > 1000 ? 'warning' : stat.average > 2000 ? 'error' : 'success'} number">\${stat.average.toFixed(0)}ms</div>
                    <div class="endpoint-stat-label">⚡ Average</div>
                </div>
                <div class="endpoint-stat-card">
                    <div class="endpoint-stat-value info number">\${stat.median.toFixed(0)}ms</div>
                    <div class="endpoint-stat-label">📍 Median</div>
                </div>
                <div class="endpoint-stat-card">
                    <div class="endpoint-stat-value warning number">\${stat.p95.toFixed(0)}ms</div>
                    <div class="endpoint-stat-label">📈 95th %ile</div>
                </div>
                <div class="endpoint-stat-card">
                    <div class="endpoint-stat-value \${stat.errorRate > 0.05 ? 'error' : stat.errorRate > 0.01 ? 'warning' : 'success'} number">\${(stat.errorRate * 100).toFixed(2)}%</div>
                    <div class="endpoint-stat-label">🎯 Error Rate</div>
                </div>
                <div class="endpoint-stat-card">
                    <div class="endpoint-stat-value info number">\${stat.throughput.toFixed(2)}/sec</div>
                    <div class="endpoint-stat-label">🚀 Throughput</div>
                </div>
            \`;
            
            // Create response time distribution chart
            createEndpointChart(stat);
            
            // Create performance metrics chart
            createEndpointMetricsChart(stat);
        }

        function createEndpointChart(stat) {
            const ctx = document.getElementById('endpointChart').getContext('2d');
            
            // Destroy existing chart
            if (currentEndpointChart) {
                currentEndpointChart.destroy();
            }
            
            currentEndpointChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Min', 'Median', '90th %ile', '95th %ile', '99th %ile', 'Max'],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [stat.min, stat.median, stat.p90, stat.p95, stat.p99, stat.max],
                        backgroundColor: [
                            'rgba(56, 161, 105, 0.8)',   // Min - Green
                            'rgba(49, 130, 206, 0.8)',   // Median - Blue
                            'rgba(217, 158, 46, 0.8)',   // 90th - Yellow
                            'rgba(237, 137, 54, 0.8)',   // 95th - Orange
                            'rgba(229, 62, 62, 0.8)',    // 99th - Red
                            'rgba(128, 90, 213, 0.8)'    // Max - Purple
                        ],
                        borderColor: [
                            '#38a169', '#3182ce', '#d69e2e', '#ed8936', '#e53e3e', '#805ad5'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: 'Response Time Percentiles'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Response Time (ms)' }
                        }
                    }
                }
            });
        }

        function createEndpointMetricsChart(stat) {
            const ctx = document.getElementById('endpointMetricsChart').getContext('2d');
            
            // Destroy existing chart
            if (currentEndpointMetricsChart) {
                currentEndpointMetricsChart.destroy();
            }
            
            const successRate = (1 - stat.errorRate) * 100;
            const errorRate = stat.errorRate * 100;
            
            currentEndpointMetricsChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Success Rate', 'Error Rate'],
                    datasets: [{
                        data: [successRate, errorRate],
                        backgroundColor: ['#5cb85c', '#d9534f'],
                        borderWidth: 2,
                        borderColor: '${cardBg}'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        },
                        title: {
                            display: true,
                            text: 'Success vs Error Rate'
                        }
                    }
                }
            });
        }

        // Close modal when clicking outside of it
        window.onclick = function(event) {
            const modal = document.getElementById('endpointModal');
            if (event.target === modal) {
                closeModal();
            }
        }

        // Close modal on Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });

        // Main Dashboard Charts
        
        // Response Times Over Time Chart
        new Chart(document.getElementById('responseTimeChart'), {
            type: 'line',
            data: {
                labels: timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Response Time (ms)',
                    data: timeSeriesData.map(d => d.responseTime),
                    borderColor: '#0088cc',
                    backgroundColor: 'rgba(0, 136, 204, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Response Time (ms)' }
                    },
                    x: {
                        title: { display: true, text: 'Time' }
                    }
                }
            }
        });

        // Throughput Chart
        new Chart(document.getElementById('throughputChart'), {
            type: 'line',
            data: {
                labels: timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Throughput (req/s)',
                    data: timeSeriesData.map(d => d.throughput),
                    borderColor: '#5cb85c',
                    backgroundColor: 'rgba(92, 184, 92, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Requests per Second' }
                    },
                    x: {
                        title: { display: true, text: 'Time' }
                    }
                }
            }
        });

        // Success/Failure Pie Chart
        const successCount = ${data.summary.totalRequests - Math.round(data.summary.totalRequests * data.summary.errorRate)};
        const errorCount = ${Math.round(data.summary.totalRequests * data.summary.errorRate)};
        
        new Chart(document.getElementById('successChart'), {
            type: 'doughnut',
            data: {
                labels: ['Success', 'Errors'],
                datasets: [{
                    data: [successCount, errorCount],
                    backgroundColor: ['#5cb85c', '#d9534f'],
                    borderWidth: 2,
                    borderColor: '${cardBg}'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });

        // Response Time Percentiles Chart
        new Chart(document.getElementById('percentilesChart'), {
            type: 'bar',
            data: {
                labels: endpointStats.map(s => s.label.length > 20 ? s.label.substring(0, 20) + '...' : s.label),
                datasets: [
                    {
                        label: '90th Percentile',
                        data: endpointStats.map(s => s.p90),
                        backgroundColor: 'rgba(56, 161, 105, 0.8)'
                    },
                    {
                        label: '95th Percentile', 
                        data: endpointStats.map(s => s.p95),
                        backgroundColor: 'rgba(217, 158, 46, 0.8)'
                    },
                    {
                        label: '99th Percentile',
                        data: endpointStats.map(s => s.p99),
                        backgroundColor: 'rgba(229, 62, 62, 0.8)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Response Time (ms)' }
                    },
                    x: {
                        title: { display: true, text: 'Endpoints' }
                    }
                }
            }
        });
    </script>
</body>
</html>`
}

// Jenkins-compatible HTML generator with embedded Chart.js and drill-down functionality
function generateJenkinsCompatibleHTML(data: JenkinsCompatibleData): string {
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
    <title>${data.title}</title>
    <style>
        /* JMeter Dashboard CSS - Bootstrap-based */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
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
            border-radius: 4px;
        }
        
        .header h1 {
            font-size: 2rem;
            margin-bottom: 5px;
            color: #333;
            font-weight: 300;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.8;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: ${cardBg};
            padding: 15px;
            border: 1px solid ${borderColor};
            border-radius: 4px;
            text-align: center;
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
        
        .success { color: #38a169; }
        .warning { color: #d69e2e; }
        .error { color: #e53e3e; }
        .info { color: #3182ce; }
        
        .panel {
            background: ${cardBg};
            border: 1px solid ${borderColor};
            border-radius: 4px;
            margin-bottom: 20px;
        }
        
        .panel-heading {
            padding: 10px 15px;
            border-bottom: 1px solid ${borderColor};
            background: ${headerBg};
            border-radius: 4px 4px 0 0;
        }
        
        .panel-title {
            font-size: 16px;
            font-weight: 500;
            margin: 0;
            color: #333;
        }
        
        .panel-body {
            padding: 15px;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
            margin: 15px 0;
            border: 1px solid ${borderColor};
            background: white;
        }
        
        .table-responsive {
            overflow-x: auto;
        }
        
        .stats-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        
        .stats-table th,
        .stats-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid ${borderColor};
        }
        
        .stats-table th {
            background: ${headerBg};
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 0.5px;
        }
        
        .stats-table tr:hover {
            background: ${isDark ? '#2d3748' : '#f7fafc'};
        }
        
        .clickable-endpoint {
            cursor: pointer;
            color: #3182ce;
            text-decoration: underline;
            font-weight: bold;
        }
        
        .clickable-endpoint:hover {
            color: #2c5aa0;
        }
        
        .number {
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        }
        
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .grid-3 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }
        
        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.6);
            animation: fadeIn 0.3s;
        }
        
        .modal-content {
            background-color: ${cardBg};
            margin: 5% auto;
            padding: 0;
            border-radius: 12px;
            width: 90%;
            max-width: 1200px;
            max-height: 80vh;
            overflow-y: auto;
            animation: slideIn 0.3s;
        }
        
        .modal-header {
            padding: 20px 25px;
            border-bottom: 1px solid ${borderColor};
            background: ${headerBg};
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .close {
            color: #aaa;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
        }
        
        .close:hover,
        .close:focus {
            color: #333;
        }
        
        .tab-container {
            display: flex;
            border-bottom: 1px solid ${borderColor};
        }
        
        .tab {
            padding: 15px 25px;
            cursor: pointer;
            border: none;
            background: none;
            color: ${textColor};
            font-size: 0.9rem;
            font-weight: 500;
            border-bottom: 3px solid transparent;
        }
        
        .tab.active {
            border-bottom-color: #3182ce;
            color: #3182ce;
        }
        
        .tab-content {
            display: none;
            padding: 25px;
        }
        
        .tab-content.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from {opacity: 0;}
            to {opacity: 1;}
        }
        
        @keyframes slideIn {
            from {transform: translateY(-50px); opacity: 0;}
            to {transform: translateY(0); opacity: 1;}
        }
        
        @media (max-width: 768px) {
            .grid-2, .grid-3 {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 15px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .modal-content {
                width: 95%;
                margin: 10px auto;
            }
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding: 20px;
            opacity: 0.6;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.title}</h1>
            <p>📊 Comprehensive Performance Analysis Dashboard</p>
            <p>Test Duration: ${(data.summary.testDuration / 60).toFixed(1)} minutes | Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-value info number">${data.summary.totalRequests}</div>
                <div class="summary-label">Total Requests</div>
            </div>
            <div class="summary-card">
                <div class="summary-value ${data.summary.averageResponseTime < 500 ? 'success' : data.summary.averageResponseTime < 2000 ? 'warning' : 'error'} number">
                    ${Math.round(data.summary.averageResponseTime)}ms
                </div>
                <div class="summary-label">Average Response Time</div>
            </div>
            <div class="summary-card">
                <div class="summary-value ${data.summary.errorRate < 0.01 ? 'success' : data.summary.errorRate < 0.05 ? 'warning' : 'error'} number">
                    ${(data.summary.errorRate * 100).toFixed(2)}%
                </div>
                <div class="summary-label">Error Rate</div>
            </div>
            <div class="summary-card">
                <div class="summary-value info number">${data.summary.throughput.toFixed(1)}</div>
                <div class="summary-label">Requests/Second</div>
            </div>
        </div>
        
        <div class="grid-2">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">📈 Response Times Over Time</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="responseTimeChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">⚡ Throughput Over Time</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="throughputChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid-2">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">🥧 Request Summary</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="successChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">📊 Response Time Percentiles</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="percentilesChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="panel">
            <div class="panel-heading">
                <h3 class="panel-title">📋 Statistics Table</h3>
            </div>
            <div class="panel-body">
                <div class="table-responsive">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Label</th>
                                <th>Samples</th>
                                <th>Average</th>
                                <th>Median</th>
                                <th>90th %ile</th>
                                <th>95th %ile</th>
                                <th>99th %ile</th>
                                <th>Min</th>
                                <th>Max</th>
                                <th>Error %</th>
                                <th>Throughput</th>
                                <th>Received KB/sec</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.endpointStats.map(stat => `
                                <tr>
                                    <td><span class="clickable-endpoint" onclick="showEndpointDetails('${stat.label}')">${stat.label}</span></td>
                                    <td class="number">${stat.samples}</td>
                                    <td class="number">${Math.round(stat.average)}ms</td>
                                    <td class="number">${Math.round(stat.median)}ms</td>
                                    <td class="number">${Math.round(stat.p90)}ms</td>
                                    <td class="number">${Math.round(stat.p95)}ms</td>
                                    <td class="number">${Math.round(stat.p99)}ms</td>
                                    <td class="number">${Math.round(stat.min)}ms</td>
                                    <td class="number">${Math.round(stat.max)}ms</td>
                                    <td class="number ${stat.errorRate === 0 ? 'success' : stat.errorRate < 0.05 ? 'warning' : 'error'}">
                                        ${(stat.errorRate * 100).toFixed(2)}%
                                    </td>
                                    <td class="number">${stat.throughput.toFixed(2)}/sec</td>
                                    <td class="number">${(stat.receivedKB / data.summary.testDuration).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        ${data.errorSummary.length > 0 ? `
        <div class="panel">
            <div class="panel-heading">
                <h3 class="panel-title">❌ Error Summary</h3>
            </div>
            <div class="panel-body">
                <div class="table-responsive">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Response Code</th>
                                <th>Error Message</th>
                                <th>Count</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.errorSummary.map(error => `
                                <tr>
                                    <td class="number error"><strong>${error.responseCode}</strong></td>
                                    <td>${error.message}</td>
                                    <td class="number">${error.count}</td>
                                    <td class="number">${error.percentage.toFixed(2)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="panel">
            <div class="panel-heading">
                <h3 class="panel-title">🎯 APDEX Table</h3>
            </div>
            <div class="panel-body">
                <p style="margin-bottom: 20px; opacity: 0.8;">
                    Application Performance Index (APDEX) - Threshold: 500ms, Tolerance: 2000ms
                </p>
                <div class="table-responsive">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Label</th>
                                <th>Samples</th>
                                <th>APDEX Score</th>
                                <th>Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.apdexScores.map(apdex => {
                                let ratingClass = 'success'
                                let rating = 'Excellent'
                                if (apdex.score < 0.94) {
                                    if (apdex.score >= 0.85) { rating = 'Good'; ratingClass = 'success' }
                                    else if (apdex.score >= 0.70) { rating = 'Fair'; ratingClass = 'warning' }
                                    else if (apdex.score >= 0.50) { rating = 'Poor'; ratingClass = 'error' }
                                    else { rating = 'Unacceptable'; ratingClass = 'error' }
                                }
                                return `
                                    <tr>
                                        <td><span class="clickable-endpoint" onclick="showEndpointDetails('${apdex.label}')">${apdex.label}</span></td>
                                        <td class="number">${apdex.samples}</td>
                                        <td class="number">${apdex.score.toFixed(3)}</td>
                                        <td class="${ratingClass}"><strong>${rating}</strong></td>
                                    </tr>
                                `
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="footer">
            Generated by JMeter Style Reporter v2.0 | ${new Date().toISOString()}
        </div>
    </div>

    <!-- Modal for endpoint details -->
    <div id="endpointModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Endpoint Details</h2>
                <span class="close" onclick="closeModal()">&times;</span>
            </div>
            <div class="tab-container">
                <button class="tab active" onclick="showTab('timeline')">📈 Timeline</button>
                <button class="tab" onclick="showTab('distribution')">📊 Distribution</button>
                <button class="tab" onclick="showTab('details')">📋 Details</button>
                <button class="tab" onclick="showTab('raw')">🔍 Raw Data</button>
            </div>
            <div id="timeline" class="tab-content active">
                <div class="chart-container">
                    <canvas id="endpointTimeChart"></canvas>
                </div>
            </div>
            <div id="distribution" class="tab-content">
                <div class="chart-container">
                    <canvas id="endpointDistChart"></canvas>
                </div>
            </div>
            <div id="details" class="tab-content">
                <div id="endpointStats"></div>
            </div>
            <div id="raw" class="tab-content">
                <div class="table-responsive">
                    <table class="stats-table" id="rawDataTable">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Response Time (ms)</th>
                                <th>Status Code</th>
                                <th>Success</th>
                            </tr>
                        </thead>
                        <tbody id="rawDataBody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script>
        ${getEmbeddedChartJs()}
        
        // Global data for JavaScript
        const endpointData = ${JSON.stringify(endpointDataForJs)};
        const timeSeriesData = ${JSON.stringify(data.timeSeriesData)};
        const endpointStats = ${JSON.stringify(data.endpointStats)};
        
        // JMeter Chart configuration
        Chart.defaults.color = '#4d4d4d';
        Chart.defaults.borderColor = '#ddd';
        Chart.defaults.backgroundColor = '#fff';
        Chart.defaults.lineColor = '#0088cc';
        Chart.defaults.gridColor = '#e0e0e0';

        // Response Times Over Time Chart
        new Chart(document.getElementById('responseTimeChart'), {
            type: 'line',
            data: {
                labels: timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Response Time (ms)',
                    data: timeSeriesData.map(d => d.responseTime),
                    borderColor: '#0088cc',
                    backgroundColor: 'rgba(0, 136, 204, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Response Time (ms)' }
                    },
                    x: {
                        title: { display: true, text: 'Time' }
                    }
                }
            }
        });

        // Throughput Chart
        new Chart(document.getElementById('throughputChart'), {
            type: 'line',
            data: {
                labels: timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Throughput (req/s)',
                    data: timeSeriesData.map(d => d.throughput),
                    borderColor: '#5cb85c',
                    backgroundColor: 'rgba(92, 184, 92, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Requests per Second' }
                    },
                    x: {
                        title: { display: true, text: 'Time' }
                    }
                }
            }
        });

        // Success/Failure Pie Chart
        const successCount = ${data.summary.totalRequests - Math.round(data.summary.totalRequests * data.summary.errorRate)};
        const errorCount = ${Math.round(data.summary.totalRequests * data.summary.errorRate)};
        
        new Chart(document.getElementById('successChart'), {
            type: 'doughnut',
            data: {
                labels: ['Success', 'Errors'],
                datasets: [{
                    data: [successCount, errorCount],
                    backgroundColor: ['#5cb85c', '#d9534f'],
                    borderWidth: 2,
                    borderColor: '${cardBg}'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });

        // Response Time Percentiles Chart
        new Chart(document.getElementById('percentilesChart'), {
            type: 'bar',
            data: {
                labels: endpointStats.map(s => s.label.length > 20 ? s.label.substring(0, 20) + '...' : s.label),
                datasets: [
                    {
                        label: '90th Percentile',
                        data: endpointStats.map(s => s.p90),
                        backgroundColor: 'rgba(56, 161, 105, 0.8)'
                    },
                    {
                        label: '95th Percentile', 
                        data: endpointStats.map(s => s.p95),
                        backgroundColor: 'rgba(217, 158, 46, 0.8)'
                    },
                    {
                        label: '99th Percentile',
                        data: endpointStats.map(s => s.p99),
                        backgroundColor: 'rgba(229, 62, 62, 0.8)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Response Time (ms)' }
                    },
                    x: {
                        title: { display: true, text: 'Endpoints' }
                    }
                }
            }
        });

        // Modal functionality
        let currentEndpointChart = null;
        let currentDistributionChart = null;

        function showEndpointDetails(endpoint) {
            const modal = document.getElementById('endpointModal');
            const title = document.getElementById('modalTitle');
            title.textContent = \`📊 \${endpoint} - Detailed Analysis\`;
            
            // Get data for this endpoint
            const endpointRecords = endpointData[endpoint] || [];
            
            // Show modal
            modal.style.display = 'block';
            
            // Switch to timeline tab
            showTab('timeline');
            
            // Generate timeline chart
            setTimeout(() => {
                generateEndpointTimelineChart(endpoint, endpointRecords);
                generateEndpointDistributionChart(endpoint, endpointRecords);
                generateEndpointDetails(endpoint, endpointRecords);
                generateRawDataTable(endpoint, endpointRecords);
            }, 100);
        }

        function closeModal() {
            document.getElementById('endpointModal').style.display = 'none';
            if (currentEndpointChart) {
                currentEndpointChart.destroy();
                currentEndpointChart = null;
            }
            if (currentDistributionChart) {
                currentDistributionChart.destroy();
                currentDistributionChart = null;
            }
        }

        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');
        }

        function generateEndpointTimelineChart(endpoint, records) {
            const ctx = document.getElementById('endpointTimeChart');
            if (currentEndpointChart) {
                currentEndpointChart.destroy();
            }
            
            const sortedRecords = records.sort((a, b) => a.timestamp - b.timestamp);
            
            currentEndpointChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedRecords.map(r => new Date(r.timestamp).toLocaleTimeString()),
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: sortedRecords.map(r => r.elapsed),
                        borderColor: records.some(r => !r.success) ? '#e53e3e' : '#3182ce',
                        backgroundColor: \`rgba(\${records.some(r => !r.success) ? '229, 62, 62' : '49, 130, 206'}, 0.1)\`,
                        fill: true,
                        tension: 0.1,
                        pointBackgroundColor: sortedRecords.map(r => r.success ? '#38a169' : '#e53e3e')
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: \`\${endpoint} - Response Times Over Time\`
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Response Time (ms)' }
                        },
                        x: {
                            title: { display: true, text: 'Time' }
                        }
                    }
                }
            });
        }

        function generateEndpointDistributionChart(endpoint, records) {
            const ctx = document.getElementById('endpointDistChart');
            
            // Create histogram data
            const responseTimes = records.map(r => r.elapsed);
            const min = Math.min(...responseTimes);
            const max = Math.max(...responseTimes);
            const bucketCount = Math.min(10, records.length);
            const bucketSize = (max - min) / bucketCount;
            
            const buckets = Array(bucketCount).fill(0);
            const bucketLabels = [];
            
            for (let i = 0; i < bucketCount; i++) {
                const start = min + i * bucketSize;
                const end = start + bucketSize;
                bucketLabels.push(\`\${Math.round(start)}-\${Math.round(end)}ms\`);
            }
            
            responseTimes.forEach(time => {
                const bucketIndex = Math.min(Math.floor((time - min) / bucketSize), bucketCount - 1);
                buckets[bucketIndex]++;
            });
            
            if (currentDistributionChart) {
                currentDistributionChart.destroy();
            }
            
            currentDistributionChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: bucketLabels,
                    datasets: [{
                        label: 'Request Count',
                        data: buckets,
                        backgroundColor: 'rgba(0, 136, 204, 0.6)',
                        borderColor: '#0088cc',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: \`\${endpoint} - Response Time Distribution\`
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Number of Requests' }
                        },
                        x: {
                            title: { display: true, text: 'Response Time Range' }
                        }
                    }
                }
            });
        }

        function generateEndpointDetails(endpoint, records) {
            const responseTimes = records.map(r => r.elapsed);
            const errors = records.filter(r => !r.success);
            
            const stats = {
                samples: records.length,
                average: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
                median: calculateMedian(responseTimes),
                min: Math.min(...responseTimes),
                max: Math.max(...responseTimes),
                errorCount: errors.length,
                errorRate: (errors.length / records.length) * 100,
                firstRequest: new Date(Math.min(...records.map(r => r.timestamp))),
                lastRequest: new Date(Math.max(...records.map(r => r.timestamp)))
            };
            
            document.getElementById('endpointStats').innerHTML = \`
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div class="summary-card">
                        <div class="summary-value info number">\${stats.samples}</div>
                        <div class="summary-label">Total Samples</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value \${stats.average < 500 ? 'success' : 'warning'} number">\${Math.round(stats.average)}ms</div>
                        <div class="summary-label">Average Response Time</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value info number">\${Math.round(stats.median)}ms</div>
                        <div class="summary-label">Median Response Time</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value \${stats.errorRate === 0 ? 'success' : 'error'} number">\${stats.errorRate.toFixed(1)}%</div>
                        <div class="summary-label">Error Rate</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value info number">\${stats.min}ms</div>
                        <div class="summary-label">Min Response Time</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value \${stats.max > 2000 ? 'error' : 'info'} number">\${stats.max}ms</div>
                        <div class="summary-label">Max Response Time</div>
                    </div>
                </div>
                <div style="margin-top: 30px;">
                    <h3>📅 Test Timeline</h3>
                    <p><strong>First Request:</strong> \${stats.firstRequest.toLocaleString()}</p>
                    <p><strong>Last Request:</strong> \${stats.lastRequest.toLocaleString()}</p>
                    <p><strong>Test Duration:</strong> \${((stats.lastRequest - stats.firstRequest) / 1000 / 60).toFixed(1)} minutes</p>
                </div>
            \`;
        }

        function generateRawDataTable(endpoint, records) {
            const tbody = document.getElementById('rawDataBody');
            const sortedRecords = records.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100); // Show last 100 requests
            
            tbody.innerHTML = sortedRecords.map(record => \`
                <tr>
                    <td class="number">\${new Date(record.timestamp).toLocaleString()}</td>
                    <td class="number">\${record.elapsed}ms</td>
                    <td class="number \${record.success ? 'success' : 'error'}">\${record.responseCode}</td>
                    <td class="\${record.success ? 'success' : 'error'}">\${record.success ? '✅' : '❌'}</td>
                </tr>
            \`).join('');
        }

        function calculateMedian(values) {
            const sorted = values.slice().sort((a, b) => a - b);
            const middle = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
        }

        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('endpointModal');
            if (event.target === modal) {
                closeModal();
            }
        }
    </script>
</body>
</html>`
}

// Embedded Chart.js library for Jenkins compatibility
function getEmbeddedChartJs(): string {
  // JMeter-style Flot.js-inspired chart implementation for Jenkins compatibility
  return `
// JMeter Dashboard Chart Library - Flot.js inspired
class JMeterChart {
    static defaults = {
        color: '#4d4d4d',
        borderColor: '#ddd', 
        backgroundColor: '#fff',
        lineColor: '#0088cc',
        gridColor: '#e0e0e0'
    };
    
    constructor(ctx, config) {
        this.ctx = typeof ctx === 'string' ? document.getElementById(ctx) : ctx;
        this.config = config;
        this.render();
    }
    
    render() {
        const canvas = this.ctx;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match container
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 300;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // JMeter-style chart rendering
        if (this.config.type === 'line') {
            this.renderJMeterLineChart(ctx, canvas.width, canvas.height);
        } else if (this.config.type === 'bar') {
            this.renderJMeterBarChart(ctx, canvas.width, canvas.height);
        } else if (this.config.type === 'pie' || this.config.type === 'doughnut') {
            this.renderJMeterPieChart(ctx, canvas.width, canvas.height);
        }
    }
    
    renderJMeterLineChart(ctx, width, height) {
        const dataset = this.config.data.datasets[0];
        const data = dataset.data;
        const labels = this.config.data.labels;
        const padding = { top: 40, right: 60, bottom: 60, left: 80 };
        
        if (!data || data.length === 0) return;
        
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const maxValue = Math.max(...data);
        const minValue = Math.min(0, Math.min(...data));
        const valueRange = maxValue - minValue || 1;
        
        // JMeter grid background
        this.drawJMeterGrid(ctx, padding, chartWidth, chartHeight, width, height);
        
        // Draw axis labels
        this.drawAxisLabels(ctx, data, labels, padding, chartWidth, chartHeight, minValue, maxValue);
        
        // Draw line with JMeter styling
        ctx.strokeStyle = dataset.borderColor || JMeterChart.defaults.lineColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        data.forEach((value, index) => {
            const x = padding.left + (index / (data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Draw data points
        ctx.fillStyle = dataset.borderColor || JMeterChart.defaults.lineColor;
        data.forEach((value, index) => {
            const x = padding.left + (index / (data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
    
    renderJMeterBarChart(ctx, width, height) {
        const datasets = this.config.data.datasets;
        const labels = this.config.data.labels;
        const padding = { top: 40, right: 60, bottom: 80, left: 80 };
        
        if (!datasets || datasets.length === 0) return;
        
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const barWidth = (chartWidth / labels.length) * 0.6;
        const maxValue = Math.max(...datasets.flatMap(d => d.data));
        
        // JMeter grid background
        this.drawJMeterGrid(ctx, padding, chartWidth, chartHeight, width, height);
        
        // Draw bars with JMeter colors
        const colors = ['#0088cc', '#5cb85c', '#f0ad4e', '#d9534f'];
        datasets.forEach((dataset, datasetIndex) => {
            const color = dataset.backgroundColor || colors[datasetIndex % colors.length];
            ctx.fillStyle = color;
            
            dataset.data.forEach((value, index) => {
                const x = padding.left + (index * chartWidth / labels.length) + (chartWidth / labels.length - barWidth) / 2;
                const barHeight = (value / maxValue) * chartHeight;
                const y = padding.top + chartHeight - barHeight;
                
                // JMeter-style bar with border
                ctx.fillRect(x, y, barWidth, barHeight);
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, barWidth, barHeight);
            });
        });
        
        // Draw labels
        ctx.fillStyle = JMeterChart.defaults.color;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        labels.forEach((label, index) => {
            const x = padding.left + (index * chartWidth / labels.length) + (chartWidth / labels.length) / 2;
            const y = height - padding.bottom + 20;
            ctx.fillText(label, x, y);
        });
    }
    
    renderJMeterPieChart(ctx, width, height) {
        const data = this.config.data.datasets[0].data;
        const labels = this.config.data.labels;
        const colors = this.config.data.datasets[0].backgroundColor || ['#5cb85c', '#d9534f', '#f0ad4e', '#0088cc'];
        
        const centerX = width / 2;
        const centerY = (height - 60) / 2;
        const radius = Math.min(width, height - 60) / 3;
        
        const total = data.reduce((sum, value) => sum + value, 0);
        let currentAngle = -Math.PI / 2;
        
        // Draw pie slices with JMeter styling
        data.forEach((value, index) => {
            const sliceAngle = (value / total) * 2 * Math.PI;
            
            ctx.fillStyle = colors[index] || '#0088cc';
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();
            
            // JMeter-style slice border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            currentAngle += sliceAngle;
        });
        
        // Draw JMeter-style legend
        const legendStartY = height - 50;
        const legendItemWidth = width / labels.length;
        labels.forEach((label, index) => {
            const x = index * legendItemWidth + 20;
            const percentage = ((data[index] / total) * 100).toFixed(1);
            
            // Legend color box
            ctx.fillStyle = colors[index];
            ctx.fillRect(x, legendStartY, 12, 12);
            
            // Legend text
            ctx.fillStyle = JMeterChart.defaults.color;
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(label + ' (' + percentage + '%)', x + 18, legendStartY + 10);
        });
    }
    
    drawJMeterGrid(ctx, padding, chartWidth, chartHeight, width, height) {
        // JMeter-style grid background
        ctx.strokeStyle = JMeterChart.defaults.gridColor;
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
            const x = padding.left + (i / 10) * chartWidth;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (i / 5) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
        
        // Chart border
        ctx.strokeStyle = JMeterChart.defaults.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(padding.left, padding.top, chartWidth, chartHeight);
    }
    
    drawAxisLabels(ctx, data, labels, padding, chartWidth, chartHeight, minValue, maxValue) {
        ctx.fillStyle = JMeterChart.defaults.color;
        ctx.font = '11px Arial';
        
        // Y-axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const value = minValue + (maxValue - minValue) * (1 - i / 5);
            const y = padding.top + (i / 5) * chartHeight;
            ctx.fillText(Math.round(value), padding.left - 10, y + 4);
        }
        
        // X-axis labels (sample some labels to avoid overcrowding)
        ctx.textAlign = 'center';
        const labelStep = Math.max(1, Math.floor(labels.length / 10));
        labels.forEach((label, index) => {
            if (index % labelStep === 0) {
                const x = padding.left + (index / (labels.length - 1)) * chartWidth;
                const y = padding.top + chartHeight + 20;
                ctx.fillText(label, x, y);
            }
        });
    }
    
    destroy() {
        if (this.ctx) {
            const ctx = this.ctx.getContext('2d');
            ctx.clearRect(0, 0, this.ctx.width, this.ctx.height);
        }
    }
}

// Compatibility alias for Chart.js API
class Chart extends JMeterChart {
    static defaults = JMeterChart.defaults;
}
`;
}

// Express middleware (simplified version)
export function performanceMiddleware(collector: PerformanceCollector) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()
    
    res.on('finish', async () => {
      const responseTime = Date.now() - startTime
      await collector.recordMetric({
        endpoint: `${req.method} ${req.path}`,
        responseTime,
        statusCode: res.statusCode,
        method: req.method
      })
    })
    
    next()
  }
}

// Export everything
export default {
  createCollector,
  generateReport,
  performanceMiddleware,
  PerformanceCollector
}