# JMeter Style Reporter

A unified performance testing and reporting system that provides both **data collection** during testing and **JMeter-style HTML report generation** from CSV data.

## What Does This Tool Do?

**In simple terms:** This tool helps you measure how fast your web applications and APIs respond to requests, then creates beautiful visual reports showing the results.

Here's what happens:

1. **📊 Collect Performance Data** - As your application runs (whether during testing or in production), this tool automatically records how long each request takes, which ones succeed or fail, and other important metrics.

2. **💾 Store Everything Safely** - All the performance data gets saved to CSV files that are compatible with Apache JMeter, the industry-standard load testing tool.

3. **📈 Generate Beautiful Reports** - The tool transforms your raw performance data into professional HTML reports with interactive charts, graphs, and tables that clearly show how your application is performing.

4. **🔍 Analyze Results** - The reports help you quickly identify slow endpoints, error patterns, and performance bottlenecks so you can optimize your application.

**Perfect for:** Developers who want to monitor API performance, QA teams running load tests, DevOps engineers tracking application health, or anyone who needs to understand how fast their web services are responding to users.

## How Does CSV Data Generation Work?

The tool automatically creates **JMeter-compatible CSV files** that store your performance metrics. Here's how it works:

### 📝 CSV Format Structure
Each performance measurement becomes a row in the CSV file with these columns:

```csv
timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename
1691234567890,245,/api/users,200,true,1024,256,1,1,"Load Test"
1691234568123,150,/api/products,200,true,512,128,1,1,"Load Test"
1691234568456,500,/api/orders,500,false,0,64,1,1,"Load Test"
```

### 📊 What Each Column Means:
- **timestamp** - When the request happened (Unix timestamp)
- **elapsed** - How long the request took (milliseconds)
- **label** - Which endpoint/URL was called
- **responseCode** - HTTP status code (200, 404, 500, etc.)
- **success** - Whether the request succeeded (true/false)
- **bytes** - Response size in bytes
- **sentBytes** - Request size in bytes
- **grpThreads** - Active threads in group
- **allThreads** - Total active threads
- **Filename** - Test name/identifier

### 🔄 Automatic Generation Process:
1. **During Testing** - As your app handles requests, the collector automatically captures timing and response data
2. **Buffered Writing** - Data is efficiently batched and written to CSV files (no performance impact)
3. **JMeter Compatible** - The CSV format matches Apache JMeter's output exactly
4. **Ready for Reporting** - Once generated, the CSV can be fed into the report generator

### 💡 Key Benefits:
- **Zero Manual Work** - CSV generation happens automatically in the background
- **Industry Standard** - Works with any tool that reads JMeter CSV files
- **High Performance** - Buffered writing ensures your app stays fast
- **Flexible** - Use with existing JMeter reports or this tool's enhanced reports

### 🔧 Simple Example:
```typescript
const collector = createCollector({
  outputPath: './performance-data.csv',
  testName: 'API Test'
})

// This single call automatically generates a CSV row:
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: 245,
  statusCode: 200
})

// Result in CSV:
// timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename
// 1691234567890,245,/api/users,200,true,0,0,1,1,"API Test"
```

[![npm version](https://badge.fury.io/js/jmeter-style-reporter.svg)](https://badge.fury.io/js/jmeter-style-reporter)
[![GitHub](https://img.shields.io/github/stars/tapanagkumar/jmeter-style-reporter?style=social)](https://github.com/tapanagkumar/jmeter-style-reporter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dt/jmeter-style-reporter.svg)](https://www.npmjs.com/package/jmeter-style-reporter)

## 🚀 Features

### Data Collection
- **High-performance buffered collection** with automatic flushing
- **Thread-safe operations** for concurrent environments
- **Express middleware** for automatic API monitoring
- **CSV output** compatible with JMeter format

### Report Generation
- **Authentic JMeter-style reports** with interactive charts
- **Bootstrap panel design** matching Apache JMeter dashboard
- **Interactive drill-down charts** for individual endpoint analysis
- **🔥 100% Jenkins Compatible** - Self-contained HTML with no external dependencies
- **Embedded charting** - Works in secure corporate environments
- **Responsive design** that works on all devices

### Chart Features
- **JMeter color scheme** (#0088cc, #5cb85c, #d9534f, #f0ad4e)
- **Grid-based charts** with proper axis labeling
- **Timeline charts** for response times and throughput
- **Pie charts** for success/error ratios
- **Bar charts** for response time percentiles
- **APDEX tables** with performance ratings

## 📦 Installation

```bash
# Install globally for CLI usage
npm install -g jmeter-style-reporter

# Install locally for programmatic usage
npm install jmeter-style-reporter

# Or use directly with npx
npx jmeter-style-reporter --help
```

## 🎯 Quick Start

### 1. Data Collection
```typescript
import { createCollector } from 'jmeter-style-reporter'

const collector = createCollector({
  outputPath: './performance-data.csv',
  testName: 'API Load Test'
})

// Record metrics
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: 245,
  statusCode: 200
})

await collector.flush() // Ensure all data is written
```

### 2. Report Generation
```bash
# CLI
jmeter-style-reporter report ./performance-data.csv --output ./reports

# Programmatic
import { generateReport } from 'jmeter-style-reporter'

await generateReport({
  csv: './performance-data.csv',
  output: './reports',
  title: 'API Performance Report'
})
```

## 🔧 Framework Integrations

### Express.js Middleware
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

// Generate report on server shutdown
process.on('SIGTERM', async () => {
  await collector.flush()
  await generateReport({
    csv: './api-performance.csv',
    output: './reports'
  })
})
```

## 💻 CLI Commands

### Report Generation
```bash
# Generate basic report
jmeter-style-reporter report ./data.csv

# Generate with custom options
jmeter-style-reporter report ./data.csv --output ./reports --title "API Load Test"

# Show help
jmeter-style-reporter --help
```

### Available CLI Options
- `--output, -o <dir>`: Output directory (default: ./jmeter-report)
- `--title, -t <title>`: Report title
- `--theme <theme>`: Theme: light, dark, auto (default: auto)
- `--jenkins`: Generate Jenkins-compatible report (no external dependencies)
- `--embedded-charts`: Use embedded charts instead of CDN

## 🏗️ Jenkins Integration (100% Compatible)

This tool is **specifically designed for Jenkins** and works perfectly with Jenkins HTML Publisher plugin. The reports are completely self-contained with no external dependencies.

### ✅ Why 100% Jenkins Compatible?

**Jenkins blocks external resources** for security reasons, but our reports work because:
- ✅ **No CDN dependencies** - All JavaScript/CSS is embedded
- ✅ **Self-contained HTML** - Single file with everything included
- ✅ **No external API calls** - Works in secure corporate networks
- ✅ **Content Security Policy compliant** - No inline scripts that violate CSP

### 🚀 Jenkins Setup Guide

#### 1. **Install Jenkins HTML Publisher Plugin**
```bash
# In Jenkins: Manage Jenkins > Plugin Manager
# Install "HTML Publisher plugin"
```

#### 2. **Generate Jenkins-Compatible Reports**
```bash
# CLI with Jenkins flag
jmeter-style-reporter report ./performance-data.csv --jenkins --output ./jenkins-reports

# Or programmatically
const result = await generateJMeterReport({
  csv: './performance-data.csv',
  output: './jenkins-reports',
  jenkinsCompatible: true  // This is the key setting!
})
```

#### 3. **Configure Jenkins Job**
Add this to your Jenkins pipeline or build configuration:

```groovy
// Jenkinsfile example
pipeline {
    agent any
    stages {
        stage('Performance Tests') {
            steps {
                // Run your performance tests (JMeter, k6, custom, etc.)
                sh 'your-performance-test-command'
                
                // Generate Jenkins-compatible report
                sh 'jmeter-style-reporter report ./test-results.csv --jenkins --output ./performance-report --title "Pipeline Performance Report"'
            }
        }
    }
    post {
        always {
            // Publish HTML report in Jenkins
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'performance-report',
                reportFiles: 'index.html',
                reportName: 'Performance Report',
                reportTitles: 'Performance Test Results'
            ])
        }
    }
}
```

#### 4. **For Freestyle Jobs**
1. Add build step: **Execute shell**
```bash
jmeter-style-reporter report ./performance-data.csv --jenkins --output ./jenkins-reports
```

2. Add post-build action: **Publish HTML reports**
   - **HTML directory to archive**: `jenkins-reports`
   - **Index page**: `index.html`
   - **Report title**: `Performance Report`
   - ✅ Check "Keep past HTML reports"

### 🎯 Jenkins Best Practices

```typescript
// Recommended Jenkins configuration
const jenkinsReport = await generateJMeterReport({
  csv: process.env.PERFORMANCE_DATA_PATH,
  output: './jenkins-reports',
  title: `Performance Report - Build #${process.env.BUILD_NUMBER}`,
  jenkinsCompatible: true,  // Essential for Jenkins!
  theme: 'light',          // Better for corporate environments
  maxMemoryUsageMB: 256    // Limit memory for Jenkins agents
})
```

### 📋 Jenkins Troubleshooting

**Problem**: Charts not showing in Jenkins?
**Solution**: Use `--jenkins` flag or `jenkinsCompatible: true`

**Problem**: "Content blocked" errors?
**Solution**: Reports are self-contained, no external content is loaded

**Problem**: Large files causing memory issues?
**Solution**: Use `maxMemoryUsageMB` option to limit memory usage

### 🔒 Corporate Network Compatibility

Works perfectly in:
- ✅ Corporate firewalls
- ✅ Air-gapped environments  
- ✅ Networks with CDN blocks
- ✅ Strict Content Security Policies
- ✅ Zero-trust security models

## 📊 CSV Data Format

The system expects CSV data with the following JMeter-compatible columns:

```csv
timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename
1691234567890,245,/api/users,200,true,1024,256,1,1,"API Load Test"
1691234568123,156,/api/products,200,true,2048,128,1,1,"API Load Test"
1691234568456,312,/api/orders,500,false,0,256,1,1,"API Load Test"
```

### Column Descriptions:
- **timestamp**: Unix timestamp in milliseconds
- **elapsed**: Response time in milliseconds
- **label**: Endpoint or request name
- **responseCode**: HTTP status code
- **success**: Boolean (true/false)
- **bytes**: Response size in bytes (optional)
- **sentBytes**: Request size in bytes (optional)
- **grpThreads**: Thread group threads (optional)
- **allThreads**: All threads (optional)
- **Filename**: Test name or description

## 🎨 Generated Reports

The system generates comprehensive JMeter-style HTML reports including:

### Charts (JMeter-style)
- **Response Time Over Time**: Line chart with grid background and data points
- **Throughput Over Time**: Requests per second visualization
- **Request Summary**: Pie chart showing success/error ratios
- **Response Time Percentiles**: Bar chart with JMeter colors

### Tables
- **Statistics Table**: Clickable endpoints with min, max, average, percentiles
- **APDEX Table**: Application Performance Index with ratings
- **Error Summary**: Detailed error breakdown (when errors exist)

### Interactive Features
- **Drill-down modals**: Click any endpoint to see detailed charts
- **Individual endpoint analysis**: Timeline, distribution, and raw data tabs
- **JMeter color scheme**: Authentic Apache JMeter appearance
- **Jenkins compatibility**: Self-contained HTML with embedded assets

## ⚙️ Configuration Options

### Collector Options
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

### Report Options
```typescript
interface ReportOptions {
  csv: string | string[]      // Input CSV file(s)
  output?: string            // Output directory (default: ./jmeter-report)
  title?: string             // Report title (default: "Performance Report")
  theme?: 'light' | 'dark' | 'auto'  // Theme (default: auto)
}
```

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
name: Performance Testing
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm ci
          npm install -g jmeter-style-reporter
      
      - name: Run performance tests
        run: |
          # Run your tests with data collection
          npm run test:performance
          
          # Generate JMeter-style report
          jmeter-style-reporter report ./performance-data.csv --output ./reports
      
      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: reports/
```

### Jenkins Pipeline
```groovy
pipeline {
  agent any
  
  stages {
    stage('Performance Tests') {
      steps {
        script {
          // Install reporter
          sh 'npm install -g jmeter-style-reporter'
          
          // Run tests with collection
          sh 'npm run test:performance'
          
          // Generate JMeter-style report
          sh 'jmeter-style-reporter report ./perf-data.csv --output ./reports --title "Build #${BUILD_NUMBER}"'
        }
      }
    }
  }
  
  post {
    always {
      // Archive performance data
      archiveArtifacts artifacts: 'perf-data.csv', fingerprint: true
      
      // Publish HTML report
      publishHTML target: [
        allowMissing: false,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: 'reports',
        reportFiles: 'index.html',
        reportName: 'Performance Report'
      ]
    }
  }
}
```

## 🔧 API Reference

### Core Functions

#### `createCollector(options: CollectorOptions): PerformanceCollector`
Creates a new performance data collector.

#### `generateReport(options: ReportOptions): Promise<ReportResult>`
Generates a JMeter-style HTML report from CSV data.

#### `performanceMiddleware(collector: PerformanceCollector)`
Express middleware for automatic performance tracking.

### PerformanceCollector Methods

#### `recordMetric(metric: PerformanceMetric): Promise<void>`
Records a single performance metric.

#### `flush(): Promise<void>`
Flushes buffered data to CSV file.

### PerformanceMetric Interface
```typescript
interface PerformanceMetric {
  endpoint?: string
  responseTime?: number
  statusCode?: number
  method?: string
  timestamp?: number
  success?: boolean
  testName?: string
  customFields?: Record<string, any>
}
```

## 📚 Examples

Check out the [examples directory](./examples/) for complete working examples:

- **Express API Monitoring**: Full Express app with automatic performance tracking
- **Load Testing Script**: Complete load testing example with report generation
- **Basic API Test**: Simple API testing with JMeter-style reporting

Also see the [api-test-demo directory](./api-test-demo/) for working demonstrations:

- **basic-api-test.js**: Simple API testing example
- **load-test.js**: Multi-user load testing example
- **Generated reports**: Sample JMeter-style HTML reports

## 🎯 JMeter Compatibility

This tool generates reports that closely match Apache JMeter's HTML dashboard:

- **Visual Design**: Bootstrap panels with JMeter's exact styling
- **Color Scheme**: Authentic JMeter colors (#0088cc, #5cb85c, #d9534f)
- **Chart Types**: Flot.js-inspired charts matching JMeter's appearance
- **Grid Layout**: Proper grid backgrounds and axis labeling
- **Data Format**: Full compatibility with JMeter CSV format
- **Interactive Features**: Drill-down functionality for endpoint analysis

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Apache JMeter's reporting format and visual design
- Uses JMeter-compatible CSV format for seamless integration
- Built with performance and developer experience in mind
- Thanks to the open-source community for the excellent libraries used

---

**Made with ❤️ for performance testing**