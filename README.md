# JMeter Style Reporter

Transform your API performance data into actionable insights with **automated build-to-build comparison** and **Jenkins dashboard widgets**.

[![npm version](https://badge.fury.io/js/jmeter-style-reporter.svg)](https://badge.fury.io/js/jmeter-style-reporter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

### Install
```bash
npm install -g jmeter-style-reporter
```

### Generate Reports
```bash
# From CSV file
npx jmeter-style-reporter report performance-data.csv

# With Jenkins dashboard widgets
npx jmeter-style-reporter report data.csv --jenkins --embedded-charts
```

### What You Get
- **📊 Interactive HTML Reports** - Charts, tables, drill-down analysis
- **📈 Build Comparison** - Automatic ↓ ↑ → trend indicators vs previous builds
- **🎯 Jenkins Dashboard Widgets** - Performance status directly on build page
- **⚡ Performance Gates** - Fail builds when performance degrades

### Generated Output Files
```
jmeter-report/
├── index.html                           # 📊 Main interactive report
├── jenkins-performance-badge.html       # 🎯 Jenkins dashboard widget
├── performance-results.xml              # 📄 JUnit XML for Jenkins
├── .build-comparison.json               # 📈 Build comparison data
└── allure-report/widgets/
    ├── summary.json                     # 📊 Performance summary
    └── trend.json                       # 📈 Trend data
```

## 📊 Programmatic Usage

### Generate Reports from Code
```javascript
import { generateReport } from 'jmeter-style-reporter'

await generateReport({
  csv: './performance-data.csv',
  output: './reports',
  title: 'API Performance Report',
  jenkinsCompatible: true
})
```

### Collect Performance Data
```javascript
import { createCollector } from 'jmeter-style-reporter'

const collector = createCollector({ 
  outputPath: './api-performance.csv' 
})

// Record metrics
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: 245,
  statusCode: 200
})

await collector.flush() // Save to CSV
```

### Express.js Middleware
```javascript
import { performanceMiddleware } from 'jmeter-style-reporter'

const collector = createCollector({ outputPath: './metrics.csv' })
app.use(performanceMiddleware(collector))

// Automatically collects data for all API calls
```

## 🏗️ Jenkins Integration

### Simple Setup
```groovy
pipeline {
    agent any
    stages {
        stage('API Tests') {
            steps {
                sh 'npm run test:api'  // Generates CSV
                sh 'npx jmeter-style-reporter report performance-data.csv --jenkins'
            }
        }
    }
    post {
        always {
            // Show performance widget on build page
            publishHTML([
                reportDir: 'jmeter-report',
                reportFiles: 'jenkins-performance-badge.html',
                reportName: 'Performance Status'
            ])
            
            // Full interactive report
            publishHTML([
                reportDir: 'jmeter-report',
                reportFiles: 'index.html',
                reportName: 'Performance Report'
            ])
        }
    }
}
```

### Jenkins Dashboard Widget
The tool automatically creates a performance widget on your Jenkins build page:

```
┌─────────────────────────────────────────┐
│ API Performance               Healthy   │
├─────────────────────────────────────────┤
│   Avg Response    Error Rate   Requests │
│      245ms           2.1%         150   │
│                                         │
│            ↓ 50ms faster               │
└─────────────────────────────────────────┘
```

## 📋 CSV Format
```csv
timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename
1691234567890,245,/api/users,200,true,1024,256,1,1,"API Test"
1691234568123,156,/api/products,200,true,2048,128,1,1,"API Test"
```

## 🎯 Build Comparison
- **First Build**: Creates baseline performance data
- **Next Builds**: Shows ↓ ↑ → trends vs previous build  
- **Automatic**: Uses `BUILD_NUMBER` environment variable
- **Smart Thresholds**: 5% change determines stable vs changed

## 📚 Documentation

- **[Examples](examples/)** - Ready-to-run demo files for all use cases
- **[Jenkins Setup Guide](docs/JENKINS.md)** - Complete Jenkins integration
- **[API Reference](docs/API.md)** - Programmatic usage and options
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for API performance monitoring**