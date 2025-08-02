# JMeter Style Reporter

A unified performance testing and reporting system that provides both **data collection** during testing and **JMeter-style HTML report generation** from CSV data.

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
- **Authentic JMeter-style reports** with Flot.js-inspired charts
- **Bootstrap panel design** matching Apache JMeter dashboard
- **Interactive drill-down charts** for individual endpoint analysis
- **Jenkins-compatible HTML** (self-contained, no external dependencies)
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