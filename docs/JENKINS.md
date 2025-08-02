# Jenkins Integration Guide

Complete guide for integrating jmeter-style-reporter with Jenkins for API performance monitoring and build-to-build comparison.

## 🚀 Quick Setup

### Required Jenkins Plugins
```bash
# Install these Jenkins plugins:
- Performance Plugin
- JUnit Plugin  
- HTML Publisher Plugin
- Pipeline Plugin
```

### Basic Pipeline with Dashboard Widgets
```groovy
pipeline {
    agent any
    
    stages {
        stage('API Tests') {
            steps {
                sh 'npm run test:api'  // Your tests generate CSV
                sh 'npx jmeter-style-reporter report performance-data.csv --jenkins'
            }
        }
    }
    
    post {
        always {
            // Performance widget on build page
            publishHTML([
                reportDir: 'jmeter-report',
                reportFiles: 'jenkins-performance-badge.html',
                reportName: 'Performance Status'
            ])
            
            // Full interactive report
            publishHTML([
                reportDir: 'jmeter-report',
                reportFiles: 'index.html',
                reportName: 'API Performance Report'
            ])
            
            // Archive build data for comparison
            archiveArtifacts artifacts: 'jmeter-report/.build-comparison.json'
        }
    }
}
```

### Jenkins Dashboard Widget
The tool automatically generates `jenkins-performance-badge.html` which creates a performance widget directly on your Jenkins build page:

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

**Status Colors:**
- 🟢 **Healthy**: Response < 500ms, Errors < 5%
- 🟡 **Warning**: Response < 1000ms, Errors < 10%  
- 🔴 **Critical**: Response > 1000ms, Errors > 10%

**Trend Indicators:**
- **↓ 50ms faster** = Performance improved vs previous build
- **↑ 100ms slower** = Performance degraded vs previous build  
- **→ stable** = Performance unchanged (within 5%)
```

## 📊 Build-to-Build Comparison

### How It Works
1. **First Build**: Creates baseline `.build-comparison.json`
2. **Subsequent Builds**: Compares against previous build data
3. **Visual Indicators**: Shows performance deltas in reports
   - 🟢 **↓ -150ms** = Performance improved
   - 🔴 **↑ +200ms** = Performance degraded  
   - ⚪ **→ +5ms** = Performance stable

### Advanced Pipeline with Build Comparison
```groovy
pipeline {
    agent any
    
    environment {
        PERFORMANCE_THRESHOLD_WARNING = '300'
        PERFORMANCE_THRESHOLD_ERROR = '1000'
    }
    
    stages {
        stage('API Tests') {
            steps {
                script {
                    // Run API tests
                    sh 'npm run test:api'
                    
                    // Copy previous build comparison data
                    script {
                        def previousBuild = currentBuild.previousBuild
                        if (previousBuild != null) {
                            copyArtifacts(
                                projectName: env.JOB_NAME,
                                selector: lastSuccessful(),
                                filter: 'performance-report/.build-comparison.json',
                                target: './',
                                optional: true
                            )
                        }
                    }
                    
                    // Generate report with build comparison
                    sh '''
                        npx jmeter-style-reporter \\
                            --csv performance-results.csv \\
                            --output ./performance-report \\
                            --title "API Performance - Build #${BUILD_NUMBER}" \\
                            --compare-to-previous \\
                            --jenkins-compatible \\
                            --generate-xml \\
                            --performance-threshold-warning ${PERFORMANCE_THRESHOLD_WARNING} \\
                            --performance-threshold-error ${PERFORMANCE_THRESHOLD_ERROR}
                    '''
                }
            }
        }
    }
    
    post {
        always {
            // Archive build comparison data for next build
            archiveArtifacts artifacts: 'performance-report/.build-comparison.json', fingerprint: true, allowEmptyArchive: true
            
            // Publish HTML report
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'performance-report',
                reportFiles: 'index.html',
                reportName: 'API Performance Report'
            ])
            
            // Publish test results for trend tracking
            junit 'performance-report/performance-results.xml'
            
            // Performance gate check
            script {
                if (fileExists('performance-report/allure-report/widgets/summary.json')) {
                    def summary = readJSON file: 'performance-report/allure-report/widgets/summary.json'
                    def failedTests = summary.statistic.failed
                    
                    if (failedTests > 0) {
                        currentBuild.result = 'UNSTABLE'
                        echo "⚠️ Performance regression detected: ${failedTests} endpoints exceed thresholds"
                    } else {
                        echo "✅ All performance checks passed"
                    }
                }
            }
        }
    }
}
```

## 🎯 XML Test Results

### How XML Generation Works
- Each endpoint becomes a test case
- Performance thresholds determine pass/fail
- Build comparison data included in failure messages
- Perfect for Jenkins JUnit plugin integration

### Generated XML Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="API Performance Tests" tests="8" failures="2" time="12.450">
  <testsuite name="GET Endpoints" tests="5" failures="1" timestamp="2025-08-02T10:00:00Z">
    
    <!-- Healthy endpoint -->
    <testcase classname="GET" name="/api/users" time="0.245">
      <!-- 245ms average, ↓ -30ms vs previous build -->
    </testcase>
    
    <!-- Endpoint exceeding threshold -->
    <testcase classname="GET" name="/api/analytics" time="1.250">
      <failure message="Average response time (1250ms) exceeded error threshold of 1000ms." type="PerformanceThreshold">
        <![CDATA[
          Endpoint: /api/analytics
          Value: 1250ms (↑ +200ms vs previous)
          Threshold: 1000ms
          Trend: Performance degraded from previous build
        ]]>
      </failure>
    </testcase>
    
  </testsuite>
</testsuites>
```

### Configurable Thresholds
```bash
# Set custom thresholds
--performance-threshold-warning 250
--performance-threshold-error 800
--error-rate-threshold 3
```

## 🔧 External Template Integration

The tool uses your existing template configuration:

### Template Files
- **template.js**: Your existing template with Chart.js integration
- **chart-generator.js**: Processes template with build comparison data
- **Automatic Integration**: Build deltas injected into existing structure

### Benefits
- ✅ No changes to your current Jenkins setup required
- ✅ Maintains your custom styling and branding
- ✅ Build comparison column automatically added
- ✅ Self-contained HTML works in corporate environments

## 📈 Performance Gates

### Basic Performance Gate
```groovy
script {
    if (fileExists('performance-report/allure-report/widgets/summary.json')) {
        def summary = readJSON file: 'performance-report/allure-report/widgets/summary.json'
        def failedTests = summary.statistic.failed
        
        if (failedTests > 0) {
            currentBuild.result = 'UNSTABLE'
            echo "⚠️ Performance gate failed: ${failedTests} endpoints exceed thresholds"
        }
    }
}
```

### Advanced Performance Gate with Notifications
```groovy
script {
    if (fileExists('performance-report/allure-report/widgets/summary.json')) {
        def summary = readJSON file: 'performance-report/allure-report/widgets/summary.json'
        def failedTests = summary.statistic.failed
        def avgResponseTime = summary.performance?.averageResponseTime ?: 0
        
        if (failedTests > 0) {
            currentBuild.result = 'UNSTABLE'
            
            // Send Slack notification
            slackSend(
                color: 'warning',
                message: "🐌 API Performance regression in build #${BUILD_NUMBER}\\n" +
                         "Failed endpoints: ${failedTests}\\n" +
                         "Average response time: ${avgResponseTime.round()}ms"
            )
        } else {
            echo "✅ Performance gate passed: All endpoints within thresholds"
        }
    }
}
```

## 🏗️ Freestyle Job Configuration

### Build Steps
1. **Execute shell**:
   ```bash
   npm run test:api
   npx jmeter-style-reporter \\
       --csv performance-results.csv \\
       --output ./performance-report \\
       --compare-to-previous \\
       --jenkins-compatible \\
       --generate-xml
   ```

2. **Post-build Actions**:
   - **Publish HTML reports**:
     - HTML directory: `performance-report`
     - Index page: `index.html`
     - Report title: `API Performance Report`
   - **Publish JUnit test result report**:
     - Test report XMLs: `performance-report/performance-results.xml`
   - **Archive the artifacts**:
     - Files: `performance-report/**/*`

## 🔍 Troubleshooting

### Common Issues

**Charts not showing in Jenkins?**
- Solution: Use `--jenkins-compatible` flag
- Ensures self-contained HTML with embedded resources

**Build comparison not working?**
- Ensure `.build-comparison.json` is archived
- Check that `copyArtifacts` plugin is installed
- Verify previous build data is being copied

**Performance gates not triggering?**
- Check that `allure-report/widgets/summary.json` is generated
- Verify thresholds are set correctly
- Ensure XML file is being created with `--generate-xml`

**Memory issues with large datasets?**
- Use `--max-memory-usage-mb` option to limit memory
- Consider filtering CSV data before processing

### Debug Commands
```bash
# Test report generation locally
npx jmeter-style-reporter \\
    --csv test-data.csv \\
    --output ./test-report \\
    --compare-to-previous \\
    --verbose

# Check generated files
ls -la ./test-report/
cat ./test-report/allure-report/widgets/summary.json
```

## 📋 Best Practices

1. **Archive Artifacts**: Always archive `.build-comparison.json` for next build
2. **Set Thresholds**: Configure appropriate warning/error thresholds
3. **Use Gates**: Implement performance gates to prevent regressions
4. **Monitor Trends**: Use JUnit integration for long-term trend analysis
5. **Corporate Networks**: Use `--jenkins-compatible` for air-gapped environments

## 🎯 What You Get

After integration:
- **Performance Dashboard**: Beautiful reports with build comparison
- **Trend Charts**: Jenkins JUnit plugin integration for historical data
- **Automated Gates**: Build fails when performance degrades
- **Team Visibility**: Reports accessible to entire team
- **Zero Config**: Works with your existing template setup