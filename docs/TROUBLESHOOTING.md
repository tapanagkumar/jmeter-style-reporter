# Troubleshooting Guide

Common issues and solutions for jmeter-style-reporter.

## 🔧 Installation Issues

### npm install fails
```bash
# Try clearing npm cache
npm cache clean --force
npm install -g jmeter-style-reporter

# Or use npx directly (no installation needed)
npx jmeter-style-reporter --help
```

### Permission errors on global install
```bash
# Use npx instead of global install
npx jmeter-style-reporter --csv data.csv

# Or fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

## 📊 CSV Data Issues

### "CSV file not found" error
```bash
# Check file path is absolute or relative to current directory
ls -la performance-data.csv

# Use absolute path
npx jmeter-style-reporter --csv /full/path/to/data.csv
```

### "Invalid CSV format" error
The tool expects JMeter-compatible CSV format:
```csv
timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename
1691234567890,245,/api/users,200,true,1024,256,1,1,"API Test"
```

**Common issues:**
- Missing required columns
- Wrong column order
- Non-numeric values in numeric columns

**Fix:**
```typescript
// Use the collector to generate proper format
const collector = createCollector({ outputPath: './data.csv' })
await collector.recordMetric({
  endpoint: '/api/users',
  responseTime: 245,
  statusCode: 200
})
```

### Empty or corrupted CSV
```bash
# Check file content
head -5 performance-data.csv

# Regenerate CSV with collector
node -e "
const { createCollector } = require('jmeter-style-reporter');
const collector = createCollector({ outputPath: './test.csv' });
collector.recordMetric({
  endpoint: '/test',
  responseTime: 100,
  statusCode: 200
}).then(() => collector.flush());
"
```

## 🏗️ Jenkins Issues

### Charts not showing in Jenkins
**Cause:** Jenkins blocks external resources for security

**Solution:** Use `--jenkins-compatible` flag
```bash
npx jmeter-style-reporter \\
    --csv data.csv \\
    --jenkins-compatible \\
    --output ./reports
```

### "Content blocked" errors
**Cause:** Corporate firewall or Content Security Policy

**Solution:** Reports are self-contained when using `--jenkins-compatible`
```groovy
// In Jenkins pipeline
sh '''
    npx jmeter-style-reporter \\
        --csv performance-data.csv \\
        --jenkins-compatible
'''
```

### Build comparison not working
**Cause:** Previous build data not available

**Solution:** Archive comparison data
```groovy
post {
    always {
        // Archive for next build
        archiveArtifacts artifacts: 'performance-report/.build-comparison.json', allowEmptyArchive: true
        
        // Copy from previous build
        script {
            copyArtifacts(
                projectName: env.JOB_NAME,
                selector: lastSuccessful(),
                filter: 'performance-report/.build-comparison.json',
                optional: true
            )
        }
    }
}
```

### JUnit XML not processed
**Cause:** XML file not generated or wrong path

**Solution:** Check XML generation and path
```groovy
// Generate XML
sh 'npx jmeter-style-reporter --csv data.csv --generate-xml'

// Check file exists
sh 'ls -la performance-report/performance-results.xml'

// Publish with correct path
junit 'performance-report/performance-results.xml'
```

## 🎯 Performance Issues

### Memory errors with large datasets
**Cause:** Dataset too large for available memory

**Solution:** Limit memory usage
```bash
npx jmeter-style-reporter \\
    --csv large-data.csv \\
    --max-memory-usage-mb 512
```

### Slow report generation
**Cause:** Large CSV files or complex calculations

**Solutions:**
```bash
# Filter data before processing
head -10000 large-data.csv > filtered-data.csv

# Use streaming mode for large files
npx jmeter-style-reporter \\
    --csv large-data.csv \\
    --streaming-mode

# Disable detailed charts for faster processing
npx jmeter-style-reporter \\
    --csv data.csv \\
    --disable-charts
```

### Build comparison calculation errors
**Cause:** Incompatible data formats between builds

**Solution:** Ensure consistent CSV format
```bash
# Validate CSV format
npx jmeter-style-reporter --validate-csv data.csv

# Use same collection method across builds
const collector = createCollector({
  outputPath: './data.csv',
  testName: 'API Test'  // Keep consistent
})
```

## 🔍 Template Issues

### External template not loading
**Cause:** Template files missing or incorrect path

**Solution:** Check template files exist
```bash
# Check template files
ls -la src/template.js src/chart-generator.js

# Use absolute paths if needed
npx jmeter-style-reporter \\
    --csv data.csv \\
    --template-path /full/path/to/template.js
```

### Template compilation errors
**Cause:** Syntax errors in template.js

**Solution:** Validate template syntax
```bash
# Test template syntax
node -e "require('./src/template.js')"

# Check for common issues:
# - Missing module.exports
# - Syntax errors in template string
# - Invalid handlebars syntax
```

### Chart.js not working in template
**Cause:** Chart.js CDN blocked or template errors

**Solution:** Use embedded charts
```javascript
// In template.js, use embedded Chart.js
const template = `
<!DOCTYPE html>
<html>
<head>
    <script src="data:application/javascript;base64,${chartJsBase64}"></script>
</head>
// ... rest of template
`
```

## 📱 CLI Issues

### Command not found
```bash
# Check installation
which jmeter-style-reporter
npm list -g jmeter-style-reporter

# Use npx instead
npx jmeter-style-reporter --help

# Check PATH
echo $PATH
```

### Invalid CLI arguments
```bash
# Check available options
npx jmeter-style-reporter --help

# Common issues:
# - Wrong flag names (use --csv not -csv)
# - Missing required arguments
# - Conflicting options
```

### Permission denied writing output
```bash
# Check write permissions
ls -la ./reports/

# Create directory if needed
mkdir -p ./reports

# Use different output directory
npx jmeter-style-reporter \\
    --csv data.csv \\
    --output ~/reports
```

## 🐛 Debug Mode

### Enable verbose logging
```bash
npx jmeter-style-reporter \\
    --csv data.csv \\
    --verbose \\
    --debug
```

### Check generated files
```bash
# List all generated files
find ./reports -type f -ls

# Check summary data
cat ./reports/allure-report/widgets/summary.json | jq .

# Validate HTML
npx html-validate ./reports/index.html
```

### Test with minimal data
```bash
# Create test CSV
echo "timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename" > test.csv
echo "1691234567890,245,/api/test,200,true,1024,256,1,1,\"Test\"" >> test.csv

# Generate report
npx jmeter-style-reporter --csv test.csv --output ./test-reports
```

## 🔧 Common Solutions

### Reset and regenerate
```bash
# Clean output directory
rm -rf ./performance-report

# Regenerate with fresh data
npx jmeter-style-reporter \\
    --csv performance-data.csv \\
    --output ./performance-report \\
    --force-regenerate
```

### Validate environment
```bash
# Check Node.js version (requires >= 18)
node --version

# Check available memory
free -h

# Check disk space
df -h .
```

### Export debug information
```bash
# Create debug package
npx jmeter-style-reporter \\
    --csv data.csv \\
    --export-debug ./debug-info.zip
```

## 🆘 Getting Help

### Before reporting issues
1. **Check this troubleshooting guide**
2. **Enable debug mode** and capture logs
3. **Test with minimal data** to isolate the issue
4. **Check Jenkins logs** if using in CI/CD

### Report issues with
- Node.js version: `node --version`
- Package version: `npm list jmeter-style-reporter`
- CLI command used
- Error messages (full stack trace)
- Sample CSV data (first few lines)
- Environment details (Jenkins, local, etc.)

### GitHub Issues
Report issues at: [https://github.com/tapanagkumar/jmeter-style-reporter/issues](https://github.com/tapanagkumar/jmeter-style-reporter/issues)

Include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Debug logs if available