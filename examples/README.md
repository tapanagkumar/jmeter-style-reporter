# Examples

Practical examples showing how to use jmeter-style-reporter in different scenarios.

## 🚀 Quick Run

```bash
# Run any example
node examples/manual-collection-demo.js
node examples/express-middleware-demo.js
node examples/load-test-demo.js
node examples/jest-integration-demo.js

# Generate reports from the collected data
npx jmeter-style-reporter report examples/manual-performance.csv
npx jmeter-style-reporter report examples/api-performance.csv
npx jmeter-style-reporter report examples/load-test-performance.csv
npx jmeter-style-reporter report examples/jest-performance.csv
```

## 📁 Examples

### 1. **Manual Collection Demo** (`manual-collection-demo.js`)
**Use Case:** Load testing, custom test scenarios
- Shows how to manually record performance metrics
- Simulates 50 API calls across 5 endpoints
- Includes realistic response time variations and error rates

```bash
node examples/manual-collection-demo.js
```

### 2. **Express.js Middleware Demo** (`express-middleware-demo.js`)
**Use Case:** Production monitoring, real user traffic
- Automatically collects data for all API requests
- Starts a real Express server on port 3000
- Visit endpoints to generate performance data

```bash
node examples/express-middleware-demo.js

# In another terminal, test the APIs:
curl http://localhost:3000/api/users
curl http://localhost:3000/api/products
curl http://localhost:3000/api/orders
```

### 3. **Load Test Demo** (`load-test-demo.js`)
**Use Case:** Performance testing, capacity planning
- Simulates 25 concurrent users
- Realistic user behavior patterns
- Different endpoint usage weights

```bash
node examples/load-test-demo.js
```

### 4. **Jest Integration Demo** (`jest-integration-demo.js`)
**Use Case:** Unit/integration testing with performance tracking
- Shows how to collect performance data during tests
- Mock Jest test structure
- Includes real Jest integration code example

```bash
node examples/jest-integration-demo.js
```

## 📊 What Each Example Generates

| Example | Output File | Requests | Features |
|---------|-------------|----------|----------|
| Manual Collection | `manual-performance.csv` | 50 | Controlled test scenarios |
| Express Middleware | `api-performance.csv` | Variable | Real API monitoring |
| Load Test | `load-test-performance.csv` | ~200 | Concurrent user simulation |
| Jest Integration | `jest-performance.csv` | 4 | Test-driven performance |

## 🎯 After Running Examples

Generate reports from any collected data:

```bash
# Basic report
npx jmeter-style-reporter report examples/manual-performance.csv

# With custom title and Jenkins compatibility
npx jmeter-style-reporter report examples/load-test-performance.csv \
  --title "Load Test Results" \
  --jenkins \
  --output ./load-test-report

# Compare builds (after running same example twice)
npx jmeter-style-reporter report examples/api-performance.csv \
  --title "Build Comparison" \
  --jenkins
```

### Generated Output Files
After running any report command, you get these files:

```
jmeter-report/                            # Output directory
├── index.html                           # 📊 Main interactive HTML report
├── jenkins-performance-badge.html       # 🎯 Jenkins dashboard widget
├── performance-results.xml              # 📄 JUnit XML for Jenkins integration
├── .build-comparison.json               # 📈 Build comparison data (for next build)
└── allure-report/widgets/
    ├── summary.json                     # 📊 Performance summary (Jenkins compatible)
    └── trend.json                       # 📈 Build trend data
```

**File Usage:**
- **`index.html`** - Open in browser for full interactive report
- **`jenkins-performance-badge.html`** - Jenkins dashboard widget (shows on build page)
- **`performance-results.xml`** - Jenkins JUnit plugin integration
- **`.build-comparison.json`** - Archive this for next build comparison
- **`summary.json`** - Jenkins Performance Plugin compatibility
- **`trend.json`** - Build-to-build trend tracking

## 🔧 Integration Patterns

### Real Jest Integration
```javascript
const { createCollector } = require('jmeter-style-reporter')

describe('API Performance', () => {
  let collector
  
  beforeAll(() => {
    collector = createCollector({ outputPath: './test-performance.csv' })
  })
  
  afterAll(async () => {
    await collector.flush()
  })
  
  test('API responds quickly', async () => {
    const start = Date.now()
    const response = await fetch('/api/users')
    
    await collector.recordMetric({
      endpoint: '/api/users',
      responseTime: Date.now() - start,
      statusCode: response.status
    })
    
    expect(response.status).toBe(200)
  })
})
```

### Real Express.js Setup
```javascript
const express = require('express')
const { createCollector, performanceMiddleware } = require('jmeter-style-reporter')

const app = express()
const collector = createCollector({ outputPath: './production-metrics.csv' })

// Automatically collect performance data
app.use(performanceMiddleware(collector))

// Your API routes
app.get('/api/users', (req, res) => {
  // Your logic here
  res.json({ users: [] })
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await collector.flush()
  process.exit(0)
})
```

## 🎯 Next Steps

1. **Run the examples** to see how data collection works
2. **Generate reports** to see the output format
3. **Integrate into your project** using the patterns shown
4. **Set up Jenkins** using the dashboard widgets for CI/CD monitoring

Each example is self-contained and ready to run!