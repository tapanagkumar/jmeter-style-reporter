# Examples

This directory contains practical examples demonstrating how to use the JMeter Style Reporter in various scenarios.

## 📁 Available Examples

### 1. Express.js API Monitoring (`express-api-monitoring.js`)

Complete Express.js application with integrated performance monitoring.

**Features:**
- Automatic request/response time tracking
- Custom middleware integration
- Graceful shutdown with report generation
- Real-time metrics logging
- Periodic report generation

**Usage:**
```bash
# Start the Express server with monitoring
node examples/express-api-monitoring.js

# Test the endpoints
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/1
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"Test User","email":"test@example.com"}'

# Stop with Ctrl+C to generate report
```

**Generated Files:**
- `api-performance.csv` - Raw performance data
- `performance-reports/` - HTML report directory

### 2. Load Testing Script (`load-testing-script.js`)

Comprehensive load testing example with virtual users and realistic scenarios.

**Features:**
- Concurrent virtual users simulation
- Weighted endpoint selection
- Stress testing with gradual load increase
- Comprehensive performance metrics
- Automatic report generation

**Usage:**
```bash
# Run basic load test (10 users, 1 minute)
node examples/load-testing-script.js

# Run stress test (gradual load increase)
node examples/load-testing-script.js stress
```

**Configuration:**
- Modify `TEST_CONFIG` object to customize load test parameters
- Adjust `concurrentUsers`, `testDuration`, and endpoint weights
- Configure think time between requests

### 3. Jest Performance Tests (`jest-performance-tests.js`)

Integration example for Jest test suites with performance assertions.

**Features:**
- Performance assertions alongside functional tests
- Concurrent user simulation in tests
- Baseline performance benchmarks
- Error handling performance validation
- Automatic report generation after test suite

**Usage:**
```bash
# Install Jest (if not already installed)
npm install -D jest

# Run performance tests
npx jest examples/jest-performance-tests.js

# Or add to your package.json scripts:
# "test:performance": "jest examples/jest-performance-tests.js"
```

**Setup:**
Make sure your API server is running before executing tests:
```bash
node examples/express-api-monitoring.js
```

### 4. Axios Client Monitoring (`axios-client-monitoring.js`)

HTTP client monitoring with Axios interceptors.

**Features:**
- Automatic request/response monitoring
- Multiple HTTP client configurations
- Stress testing capabilities
- Real-time monitoring
- Comprehensive reporting

**Usage:**
```bash
# Run basic HTTP operations demo
node examples/axios-client-monitoring.js demo

# Run HTTP stress test
node examples/axios-client-monitoring.js stress

# Run full demonstration (demo + stress test)
node examples/axios-client-monitoring.js full
```

## 🚀 Quick Start Guide

### 1. Set Up Your Environment

```bash
# Clone or download the examples
# Install dependencies
npm install

# Install the main package
npm install jmeter-style-reporter
```

### 2. Run a Basic Example

```bash
# Start with the Express API monitoring
node examples/express-api-monitoring.js

# In another terminal, generate some traffic
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/1
curl http://localhost:3000/api/slow-endpoint

# Stop the server (Ctrl+C) to see the generated report
```

### 3. Customize for Your Use Case

Each example includes detailed comments and configuration options. Modify them according to your needs:

- **API URLs**: Update base URLs to point to your APIs
- **Test Parameters**: Adjust user counts, durations, and thresholds  
- **Endpoints**: Modify endpoint lists and request patterns
- **Reporting**: Customize report themes, titles, and output locations

## 📊 Understanding the Generated Reports

All examples generate HTML reports with:

### Charts
- **Response Time Over Time**: Shows performance trends
- **Throughput**: Requests per second visualization  
- **Percentiles**: 50th, 90th, 95th, 99th percentile response times
- **Error Rates**: Success/failure ratios

### Tables
- **Summary Statistics**: Per-endpoint performance metrics
- **Error Analysis**: Detailed error breakdowns
- **Time Range**: Test duration and timestamps

### Interactive Features
- **Responsive Design**: Works on desktop and mobile
- **Theme Toggle**: Light/dark mode
- **Data Filtering**: Filter by endpoint, time range, status
- **Zoom and Pan**: Interactive chart navigation

## 🔧 Customization Examples

### Custom Performance Thresholds

```javascript
// In jest-performance-tests.js
const PERFORMANCE_THRESHOLD_MS = 200 // Stricter threshold
const MAX_ERROR_RATE = 0.01 // 1% max error rate
```

### Custom Metrics Collection

```javascript
// Add custom fields to your metrics
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: duration,
  statusCode: response.status,
  customFields: {
    userId: 'user123',
    sessionId: 'session456',
    region: 'us-east-1',
    cached: response.headers['x-cache-hit'] === 'true'
  }
})
```

### Advanced Load Testing Patterns

```javascript
// Multi-phase load testing
const phases = [
  { users: 5, duration: 30000, name: 'Warm-up' },
  { users: 20, duration: 120000, name: 'Sustained Load' },
  { users: 50, duration: 60000, name: 'Peak Load' },
  { users: 10, duration: 30000, name: 'Cool-down' }
]
```

## 🐛 Troubleshooting

### Common Issues

1. **"Connection Refused" Errors**
   - Make sure the target API is running
   - Check the base URL configuration
   - Verify network connectivity

2. **"Module Not Found" Errors**
   - Run `npm install` in the examples directory
   - Install jmeter-style-reporter: `npm install jmeter-style-reporter`

3. **Permission Errors**
   - Ensure write permissions for output directories
   - Check file system space availability

4. **High Memory Usage**
   - Reduce buffer sizes in collector configuration
   - Enable file rotation for long-running tests
   - Use smaller test durations

### Getting Help

- Check the main [README.md](../README.md) for detailed API documentation
- Review the [API.md](../API.md) for comprehensive API reference
- Look at the [NPM_PUBLISHING_GUIDE.md](../NPM_PUBLISHING_GUIDE.md) for advanced usage

## 🎯 Best Practices

1. **Start Small**: Begin with short tests and small user counts
2. **Monitor Resources**: Watch CPU and memory usage during tests
3. **Baseline First**: Establish performance baselines before optimization
4. **Test Regularly**: Integrate performance tests into CI/CD pipelines
5. **Document Thresholds**: Clearly define acceptable performance criteria
6. **Analyze Trends**: Look for performance degradation over time
7. **Test Realistic Scenarios**: Use representative data and usage patterns

## 📈 Integration Tips

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Performance Tests
  run: |
    node examples/express-api-monitoring.js &
    sleep 5
    node examples/load-testing-script.js
    pkill -f express-api-monitoring
    
- name: Upload Reports
  uses: actions/upload-artifact@v3
  with:
    name: performance-reports
    path: '*-report*/'
```

### Monitoring Integration

```javascript
// Send metrics to monitoring systems
collector.onFlush = async (count) => {
  await sendToDatadog({
    metric: 'performance.requests.flushed',
    value: count,
    timestamp: Date.now()
  })
}
```

### Alert Integration

```javascript
// Set up performance alerts
const result = await generateReport(options)

if (result.summary.averageResponseTime > 1000) {
  await sendSlackAlert('High response times detected!')
}

if (result.summary.errorRate > 0.05) {
  await sendPagerDutyAlert('High error rate in API!')
}
```

These examples provide a solid foundation for implementing performance monitoring in your applications. Customize them based on your specific requirements and integrate them into your development workflow for continuous performance monitoring.