# Step-by-Step NPM Publishing Guide
# 🚀 Enhanced Workflow for Secure Publishing

## Prerequisites ✅

1. **Node.js installed** (check with `node --version`)
2. **NPM account** at https://www.npmjs.com (free)
3. **2FA enabled** on your NPM account (required for publishing)
4. **Terminal/Command line access**
5. **Git repository** set up for version control

---

## Step 1: Pre-Publication Quality Checks 🔍

### 1.1 Code Quality Validation
```bash
# Navigate to your project
cd /Users/gowrikumarannapantula/jmeter-style-reporter

# Run TypeScript type checking
npm run typecheck

# Run linting
npm run lint

# Fix any linting issues
npm run lint:fix

# Build the project
npm run build
```

### 1.2 Test Coverage
```bash
# Run tests (if available)
npm test

# Test the CLI functionality
node dist/cli/index.js --help

# Test package import
node -e "require('./dist/index.js'); console.log('✅ Package loads successfully')"
```

### 1.3 Security Validation
```bash
# Check for security vulnerabilities
npm audit

# Fix any high-severity issues
npm audit fix

# Verify no sensitive files are included
npm publish --dry-run
```

---

## Step 2: Version Management 📊

### 2.1 Check Current Version Status
```bash
# Check current version
npm version --no-git-tag-version

# Check if version exists on NPM
npm view jmeter-style-reporter versions --json

# View latest published version
npm view jmeter-style-reporter version
```

### 2.2 Increment Version (Choose One)
```bash
# For bug fixes (1.1.1 → 1.1.2)
npm version patch

# For new features (1.1.1 → 1.2.0)
npm version minor

# For breaking changes (1.1.1 → 2.0.0)
npm version major

# Or set specific version
npm version 1.1.2 --no-git-tag-version
```

---

## Step 3: Git Workflow & Branch Management 🌿

### 3.1 Create Release Branch
```bash
# Create and switch to release branch
git checkout -b release/v$(cat package.json | grep '"version"' | cut -d'"' -f4)

# Or manually specify version
git checkout -b release/v1.1.2

# Stage and commit version bump
git add package.json
git commit -m "chore: bump version to $(cat package.json | grep '"version"' | cut -d'"' -f4)"
```

### 3.2 Push to GitHub
```bash
# Push the release branch
git push -u origin release/v1.1.2

# Create pull request (optional)
gh pr create --title "Release v1.1.2" --body "Release notes and changelog"
```

---

## Step 4: Login to NPM 🔑

```bash
# Login to NPM (you'll need your npmjs.com username/password + 2FA)
npm login

# Verify you're logged in
npm whoami
```

**Expected Result**: Shows your NPM username

**⚠️ Important**: You'll need your authenticator app for 2FA during publishing

---

## Step 5: Package Configuration Validation 📋

### 5.1 Verify Package Details
```bash
# View your package.json key fields
cat package.json | grep -E '"name"|"version"|"description"|"keywords"'
```

**Expected Output**:
```json
"name": "jmeter-style-reporter",
"version": "1.1.1",
"description": "Enhanced performance testing and reporting system with interactive JMeter-style HTML reports, APDEX scoring, percentile calculations, Chart.js visualizations, and drill-down analytics",
"keywords": [
```

### 5.2 Validate Package Exports
```bash
# Check exports configuration
cat package.json | jq '.exports'

# Verify main entry points exist
ls -la dist/index.js dist/index.mjs dist/index.d.ts

# Test CLI binary
ls -la dist/cli/index.js
```

---

## Step 6: Pre-Publication Testing 🧪

### 6.1 Dry Run Analysis
```bash
# See what would be published without actually publishing
npm publish --dry-run

# Check package size and contents
npm pack --dry-run

# Verify file list matches expectations
```

**Expected Result**: 
- Shows files that would be included in the package
- Package size should be reasonable (< 500KB)
- No sensitive files (`.env`, `.git`, etc.)

### 6.2 Local Package Testing
```bash
# Create local package for testing
npm pack

# Install locally in test directory
mkdir ../test-package && cd ../test-package
npm init -y
npm install ../jmeter-style-reporter/jmeter-style-reporter-*.tgz

# Test functionality
npx jmeter-style-reporter --help
node -e "console.log(require('jmeter-style-reporter'))"
```

---

## Step 7: Publish to NPM 🚀

### 7.1 Final Pre-Flight Check
```bash
# Return to project directory
cd /Users/gowrikumarannapantula/jmeter-style-reporter

# Ensure clean working directory
git status

# Final build
npm run build

# One last dry run
npm publish --dry-run
```

### 7.2 Publish with 2FA
```bash
# Publish your package (you'll be prompted for OTP)
npm publish

# If you have OTP ready:
npm publish --otp=123456
```

**Expected Result**: Package uploaded successfully to NPM registry

**If you get an error**:
- **Name already exists**: Change name in package.json
- **Version exists**: Run `npm version patch` first  
- **Not logged in**: Run `npm login` again
- **OTP required**: Get code from authenticator app
- **Permission denied**: Verify package ownership

---

## Step 8: Post-Publication Verification ✅

### 8.1 Verify Package Availability
```bash
# Check your package is live
npm view jmeter-style-reporter

# Verify specific version
npm view jmeter-style-reporter@1.1.1

# Check download stats
npm view jmeter-style-reporter --json | jq '.downloads'

# View on NPM website
echo "🌐 Visit: https://www.npmjs.com/package/jmeter-style-reporter"
```

### 8.2 Test Global Installation
```bash
# Install globally to test CLI
npm install -g jmeter-style-reporter@latest

# Test CLI functionality
jmeter-style-reporter --help
jmeter-style-reporter --version

# Test report generation
echo "timestamp,elapsed,label,responseCode,success" > sample.csv
echo "1691234567890,245,/api/test,200,true" >> sample.csv
jmeter-style-reporter report sample.csv --output ./test-report
```

---

## Step 9: Integration Testing 🔍

### 9.1 Fresh Installation Test
```bash
# Create isolated test environment
mkdir ~/test-npm-package-$(date +%s)
cd ~/test-npm-package-$(date +%s)

# Create new project
npm init -y

# Install your published package
npm install jmeter-style-reporter@latest

# Test programmatic API
cat > test-enhanced.js << 'EOF'
const { 
  createCollector, 
  generateReport,
  JMeterPerformanceCollector,
  generateJMeterReport,
  StatisticsCalculator
} = require('jmeter-style-reporter');

async function test() {
  console.log('🚀 Testing Enhanced JMeter Reporter v1.1.1...');
  
  // Test basic collector
  const collector = createCollector({
    outputPath: './test.csv',
    testName: 'Enhanced Package Test'
  });
  
  // Generate test data
  for (let i = 0; i < 20; i++) {
    await collector.recordMetric({
      endpoint: `/api/endpoint-${i % 3}`,
      responseTime: Math.random() * 500 + 50,
      statusCode: Math.random() > 0.1 ? 200 : 500,
      method: 'GET'
    });
  }
  
  await collector.flush();
  console.log('✅ Data collection completed!');
  
  // Test enhanced report generation
  const result = await generateJMeterReport({
    csv: './test.csv',
    output: './test-report',
    title: 'Enhanced Package Test Report'
  });
  
  console.log('✅ Enhanced report generated!');
  console.log(`📊 Total Requests: ${result.summary.totalRequests}`);
  console.log(`⏱️  Average Response Time: ${result.summary.averageResponseTime?.toFixed(2)}ms`);
  console.log(`❌ Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`);
  console.log('📄 Open: ./test-report/index.html');
  
  // Test enhanced collector
  console.log('🔬 Testing Enhanced Collector...');
  const enhancedCollector = new JMeterPerformanceCollector({
    outputPath: './enhanced-test.csv',
    testName: 'Enhanced Collector Test'
  });
  
  await enhancedCollector.recordMetric({
    endpoint: '/api/enhanced',
    responseTime: 123,
    statusCode: 200,
    method: 'POST'
  });
  
  await enhancedCollector.flush();
  console.log('✅ Enhanced collector test completed!');
}

test().catch(console.error);
EOF

# Run comprehensive test
node test-enhanced.js
```

**Expected Result**: 
- Package installs without errors
- All APIs work correctly  
- Enhanced features (APDEX, percentiles) functional
- Interactive reports generated with Chart.js
- No missing dependencies or runtime errors

---

## 🎉 Success! Enhanced Package is Live

Your enhanced JMeter-style reporter is now available worldwide:

```bash
# Anyone can install it with:
npm install jmeter-style-reporter

# Use the CLI:
npx jmeter-style-reporter report ./data.csv

# Access enhanced features:
npx jmeter-style-reporter report ./data.csv --theme dark
```

---

## Step 10: Release Management & Maintenance 🚀

### 10.1 Post-Release GitHub Workflow
```bash
# Return to your project
cd /Users/gowrikumarannapantula/jmeter-style-reporter

# Create release tag
git tag -a v1.1.1 -m "Enhanced JMeter Reporter v1.1.1 with security fixes and interactive features"

# Push tags
git push origin --tags

# Create GitHub release
gh release create v1.1.1 --title "Enhanced JMeter Reporter v1.1.1" --notes "$(cat << 'EOF'
## 🚀 Enhanced Features
- Interactive Chart.js visualizations with JMeter styling
- APDEX scoring for performance assessment
- Percentile calculations (p50, p90, p95, p99)
- Drill-down analytics with detailed endpoint modals

## 🔒 Security Fixes
- CSV parsing vulnerabilities eliminated
- XSS prevention in HTML generation
- Memory leak fixes with proper timer cleanup
- Race condition protections

## 💫 Improvements
- Streaming support for large datasets
- Enhanced error handling
- Async I/O operations for better performance
- 100% backwards compatibility maintained
EOF
)"
```

### 10.2 Continuous Maintenance Workflow
```bash
# When making changes for next release:

# 1. Create feature branch
git checkout -b feature/new-enhancement

# 2. Make your changes
# ... code changes ...

# 3. Run quality checks
npm run typecheck
npm run lint
npm run build

# 4. Update version
npm version patch  # or minor/major

# 5. Update changelog
echo "## v$(cat package.json | grep '"version"' | cut -d'"' -f4)
- Added new enhancement
- Fixed issue X
" | cat - CHANGELOG.md > temp && mv temp CHANGELOG.md

# 6. Commit and push
git add .
git commit -m "feat: add new enhancement for v$(cat package.json | grep '"version"' | cut -d'"' -f4)"
git push -u origin feature/new-enhancement

# 7. Create release branch
git checkout -b release/v$(cat package.json | grep '"version"' | cut -d'"' -f4)
git push -u origin release/v$(cat package.json | grep '"version"' | cut -d'"' -f4)

# 8. Publish to NPM
npm publish --otp=123456

# 9. Create GitHub release
gh release create v$(cat package.json | grep '"version"' | cut -d'"' -f4)
```

### 10.3 Monitoring & Analytics
```bash
# Check package statistics
npm view jmeter-style-reporter

# Monitor downloads
npm view jmeter-style-reporter --json | jq '.downloads'

# Check dependents
npm view jmeter-style-reporter dependents

# Security audit
npm audit

# Check outdated dependencies
npm outdated
```

---

## Troubleshooting 🔧

### Pre-Publication Issues:

**"TypeScript compilation errors"**
```bash
# Check and fix TypeScript issues
npm run typecheck

# Common fixes:
# - Add missing type declarations
# - Fix import/export statements
# - Ensure all dependencies have types
```

**"ESLint/Linting errors"**
```bash
# Auto-fix linting issues
npm run lint:fix

# Manual review for remaining issues
npm run lint
```

**"Build failures"**
```bash
# Clean and rebuild
npm run clean
npm run build

# Check for missing dependencies
npm install

# Verify tsconfig.json configuration
```

### Publication Issues:

**"Package name already exists"**
```bash
# Option 1: Use scoped package
npm init --scope=@yourusername

# Option 2: Change name in package.json
# Example: "jmeter-style-reporter-yourname"
```

**"Version already published"**
```bash
# Check current published version
npm view jmeter-style-reporter version

# Increment version appropriately
npm version patch  # 1.1.1 → 1.1.2
npm version minor  # 1.1.1 → 1.2.0
npm version major  # 1.1.1 → 2.0.0
```

**"OTP/2FA required"**
```bash
# Get code from authenticator app
npm publish --otp=123456

# If OTP expires during upload, get new code
npm publish --otp=654321
```

**"Permission denied"**
```bash
# Verify package ownership
npm owner ls jmeter-style-reporter

# Add yourself as owner (if you have permission)
npm owner add yourusername jmeter-style-reporter

# Use scoped package as alternative
npm init --scope=@yourusername
```

### Post-Publication Issues:

**"Package not installing correctly"**
```bash
# Test in fresh environment
mkdir /tmp/test-install && cd /tmp/test-install
npm init -y
npm install jmeter-style-reporter@latest

# Check for missing dependencies
npm ls --depth=0
```

**"CLI not working after install"**
```bash
# Verify bin configuration in package.json
cat package.json | jq '.bin'

# Check file permissions
ls -la dist/cli/index.js

# Test direct execution
node ./node_modules/.bin/jmeter-style-reporter --help
```

**"Import/require errors"**
```bash
# Check exports configuration
cat package.json | jq '.exports'

# Test different import methods
node -e "console.log(require('jmeter-style-reporter'))"
node -e "import('jmeter-style-reporter').then(m => console.log(m))"
```

### Security & Quality Issues:

**"npm audit warnings"**
```bash
# Fix high-severity vulnerabilities
npm audit fix

# Review and fix manually
npm audit fix --force

# Check for false positives
npm audit --audit-level moderate
```

**"Large package size"**
```bash
# Analyze bundle size
npm run size

# Check what's included
npm pack --dry-run

# Optimize package.json files array
# Exclude unnecessary files in .npmignore
```

### Getting Help:

1. **NPM Documentation**: https://docs.npmjs.com/
2. **Enhanced Package**: https://www.npmjs.com/package/jmeter-style-reporter
3. **GitHub Issues**: https://github.com/tapanagkumar/jmeter-style-reporter/issues
4. **NPM Support**: https://npmjs.com/support

---

## 🏆 Congratulations!

You've successfully published your enhanced NPM package! 🎉

Your **Enhanced JMeter-style Reporter v1.1.1** is now available to developers worldwide with enterprise-grade features and security fixes.

**📊 Enhanced Package Features**:
- ✅ **Interactive Chart.js visualizations** with authentic JMeter styling
- ✅ **APDEX scoring** for performance assessment (Excellent, Good, Fair, Poor)
- ✅ **Percentile calculations** (p50, p90, p95, p99) for SLA monitoring
- ✅ **Drill-down analytics** with detailed endpoint modals
- ✅ **Security-hardened** with XSS prevention and input sanitization
- ✅ **Memory optimized** with proper cleanup and disposal patterns
- ✅ **Streaming support** for large datasets (100MB+ CSV files)
- ✅ **Express middleware** for automatic API monitoring
- ✅ **CLI and programmatic API** with TypeScript support
- ✅ **Jenkins-compatible** (self-contained HTML)
- ✅ **Branch protection** and secure development workflow
- ✅ **100% backwards compatibility** maintained

**🔒 Security Enhancements**:
- CSV parsing vulnerabilities eliminated
- XSS prevention in HTML generation
- Memory leak fixes with proper timer cleanup
- Race condition protections with atomic operations
- Enhanced error handling throughout

**📈 Analytics & Monitoring**:
You can track your package's success:
- **Downloads**: https://www.npmjs.com/package/jmeter-style-reporter
- **GitHub**: https://github.com/tapanagkumar/jmeter-style-reporter
- **Usage Stats**: `npm view jmeter-style-reporter`

**🌟 Share Your Success**:
```bash
# Share your accomplishment
echo "🎉 Published Enhanced JMeter Reporter v1.1.1 to NPM!"
echo "📦 npm install jmeter-style-reporter"
echo "🌐 https://www.npmjs.com/package/jmeter-style-reporter"
```

Your package now serves the global developer community with enterprise-grade performance testing and reporting capabilities!