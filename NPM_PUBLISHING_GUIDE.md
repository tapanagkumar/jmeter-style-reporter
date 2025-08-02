# NPM Publishing Guide

Complete guide to publish the JMeter Style Reporter package to npm registry.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Package Setup](#package-setup)
- [Build Configuration](#build-configuration)
- [Testing Before Publishing](#testing-before-publishing)
- [Publishing Process](#publishing-process)
- [Post-Publishing](#post-publishing)
- [Maintenance and Updates](#maintenance-and-updates)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### 1. npm Account and Authentication

```bash
# Create npm account (if you don't have one)
# Visit: https://www.npmjs.com/signup

# Login to npm
npm login

# Verify authentication
npm whoami

# Check authentication status
npm config get registry
```

### 2. Package Name Availability

```bash
# Check if package name is available
npm search jmeter-style-reporter

# Or check directly
npm view jmeter-style-reporter

# If name is taken, consider alternatives:
# - @yourorg/jmeter-style-reporter (scoped package)
# - jmeter-reporter
# - performance-reporter
# - jmeter-html-reporter
```

### 3. Development Environment

```bash
# Ensure you have Node.js 18+ and npm 8+
node --version  # Should be 18.0.0 or higher
npm --version   # Should be 8.0.0 or higher

# Install development dependencies
npm install

# Run tests to ensure everything works
npm test

# Build the package
npm run build
```

## Package Setup

### 1. Update package.json for Publishing

```json
{
  "name": "jmeter-style-reporter",
  "version": "1.0.0",
  "description": "Unified performance testing and reporting system with JMeter-style HTML reports",
  "keywords": [
    "jmeter",
    "performance",
    "testing",
    "reporting",
    "csv",
    "html",
    "charts",
    "jenkins",
    "ci-cd",
    "load-testing",
    "monitoring"
  ],
  "homepage": "https://github.com/yourusername/jmeter-style-reporter#readme",
  "bugs": {
    "url": "https://github.com/yourusername/jmeter-style-reporter/issues"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yourusername/jmeter-style-reporter.git"
  },
  "license": "MIT",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "url": "https://yourwebsite.com"
  },
  "contributors": [
    {
      "name": "Contributor Name",
      "email": "contributor@example.com"
    }
  ],
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./collection": {
      "import": "./dist/collection/index.mjs",
      "require": "./dist/collection/index.js",
      "types": "./dist/collection/index.d.ts"
    },
    "./reporting": {
      "import": "./dist/reporting/index.mjs",
      "require": "./dist/reporting/index.js",
      "types": "./dist/reporting/index.d.ts"
    }
  },
  "bin": {
    "jmeter-style-reporter": "./dist/cli.js"
  },
  "files": [
    "dist",
    "templates",
    "README.md",
    "API.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### 2. Create Essential Files

#### LICENSE
```bash
# Create MIT License
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

#### CHANGELOG.md
```bash
cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-08-02

### Added
- Initial release
- Performance data collection with high-throughput support
- JMeter-style HTML report generation
- Framework integrations (Express, Axios, Jest)
- CLI interface with multiple modes
- Real-time monitoring capabilities
- Unified workflows for end-to-end testing
- Comprehensive documentation and examples

### Features
- Thread-safe metric collection with buffering
- Stream-based CSV processing for large files
- Interactive charts and responsive design
- File rotation and compression
- CI/CD integration helpers
- Memory-efficient operations
EOF
```

### 3. Configure .npmignore

```bash
cat > .npmignore << 'EOF'
# Source files (only ship dist)
src/
tests/
examples/

# Development files
.env
.env.*
*.log
*.tgz

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Git files
.git/
.gitignore

# Development dependencies
node_modules/
coverage/
.nyc_output/

# Build artifacts (keep only what's needed)
dist/*.map
*.tsbuildinfo

# Documentation source (keep final docs)
docs/
*.draft.md

# Test files
jest.config.js
.eslintrc.*
.prettierrc.*
tsconfig.json
tsup.config.ts

# CI files
.github/
.gitlab-ci.yml
.travis.yml
EOF
```

## Build Configuration

### 1. Update tsup.config.ts for Publishing

```typescript
import { defineConfig } from 'tsup'

export default defineConfig([
  // Main library bundle
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    outDir: 'dist',
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    minify: true,
    treeshake: true,
    external: ['fast-csv', 'd3-array'],
    banner: {
      js: '/* JMeter Style Reporter v1.0.0 - MIT License */',
    },
  },
  // CLI bundle
  {
    entry: ['src/cli/index.ts'],
    format: ['cjs'],
    outDir: 'dist',
    outExtension: () => ({ js: '.cli.js' }),
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: true,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node\n/* JMeter Style Reporter CLI v1.0.0 */',
    },
    external: ['fast-csv', 'd3-array'],
  },
  // Collection module
  {
    entry: ['src/collection/index.ts'],
    format: ['cjs', 'esm'],
    outDir: 'dist/collection',
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: true,
    external: ['fast-csv'],
  },
  // Reporting module
  {
    entry: ['src/reporting/index.ts'],
    format: ['cjs', 'esm'],
    outDir: 'dist/reporting',
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: true,
    external: ['fast-csv', 'd3-array'],
  },
])
```

### 2. Update package.json Scripts

```json
{
  "scripts": {
    "clean": "rimraf dist",
    "build": "npm run clean && tsup",
    "build:check": "npm run build && npm run test:dist",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:dist": "node dist/cli.js --help && node -e \"require('./dist/index.js')\"",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write \"src/**/*.{ts,js,json}\"",
    "typecheck": "tsc --noEmit",
    "size": "size-limit",
    "prepublishOnly": "npm run build:check && npm run test && npm run lint",
    "prepack": "npm run build",
    "postpack": "npm run clean",
    "version": "npm run build && git add -A dist",
    "postversion": "git push && git push --tags"
  }
}
```

### 3. Add size-limit Configuration

```json
{
  "size-limit": [
    {
      "path": "dist/index.js",
      "limit": "500 KB"
    },
    {
      "path": "dist/collection/index.js",
      "limit": "200 KB"
    },
    {
      "path": "dist/reporting/index.js",
      "limit": "400 KB"
    },
    {
      "path": "dist/cli.js",
      "limit": "600 KB"
    }
  ]
}
```

## Testing Before Publishing

### 1. Local Testing

```bash
# Build and test the package
npm run build:check

# Test CLI functionality
./dist/cli.js --help
./dist/cli.js --version

# Test package installation locally
npm pack
npm install -g jmeter-style-reporter-1.0.0.tgz

# Test global CLI
jmeter-style-reporter --help

# Clean up
npm uninstall -g jmeter-style-reporter
rm jmeter-style-reporter-1.0.0.tgz
```

### 2. Test in Another Project

```bash
# Create test directory
mkdir ../test-jmeter-reporter
cd ../test-jmeter-reporter
npm init -y

# Install from local tarball
npm pack ../jmeter-style-reporter
npm install jmeter-style-reporter-1.0.0.tgz

# Test programmatic usage
cat > test.js << 'EOF'
const { createCollector, generateReport } = require('jmeter-style-reporter')

async function test() {
  console.log('Testing jmeter-style-reporter...')
  
  const collector = createCollector({
    outputPath: './test-data.csv',
    testName: 'Test Run'
  })
  
  await collector.recordMetric({
    endpoint: '/api/test',
    responseTime: 150,
    statusCode: 200
  })
  
  await collector.flush()
  console.log('✓ Data collection works')
  
  await generateReport({
    csv: './test-data.csv',
    output: './test-report'
  })
  console.log('✓ Report generation works')
}

test().catch(console.error)
EOF

node test.js

# Test CLI
npx jmeter-style-reporter --help

# Clean up
cd ../jmeter-style-reporter
rm -rf ../test-jmeter-reporter
```

### 3. Validate Package Content

```bash
# Check what will be published
npm pack --dry-run

# Inspect the package
npm pack
tar -tzf jmeter-style-reporter-1.0.0.tgz

# Validate package.json
npm run lint
npm run typecheck
npm test
```

## Publishing Process

### 1. Version Management

```bash
# Patch version (bug fixes): 1.0.0 -> 1.0.1
npm version patch

# Minor version (new features): 1.0.0 -> 1.1.0
npm version minor

# Major version (breaking changes): 1.0.0 -> 2.0.0
npm version major

# Prerelease versions
npm version prerelease --preid=alpha  # 1.0.0 -> 1.0.1-alpha.0
npm version prerelease --preid=beta   # 1.0.0 -> 1.0.1-beta.0
npm version prerelease --preid=rc     # 1.0.0 -> 1.0.1-rc.0
```

### 2. Publishing Steps

```bash
# Step 1: Final checks
npm run prepublishOnly

# Step 2: Publish to npm registry
npm publish

# For first-time publishing, you might need:
npm publish --access public

# For scoped packages:
npm publish --access public --scope=@yourorg

# For prerelease versions:
npm publish --tag beta
npm publish --tag alpha
```

### 3. Verify Publication

```bash
# Check package on npm
npm view jmeter-style-reporter

# Test installation from npm
npm install -g jmeter-style-reporter@latest
jmeter-style-reporter --version
jmeter-style-reporter --help

# Test in new project
mkdir test-npm-install
cd test-npm-install
npm init -y
npm install jmeter-style-reporter
node -e "console.log(require('jmeter-style-reporter'))"
```

## Post-Publishing

### 1. Update Documentation

```bash
# Update README with installation instructions
# Add badges for npm version, downloads, etc.
# Update API documentation if needed
# Create CHANGELOG entry
```

### 2. GitHub Release

```bash
# Create GitHub release
git tag v1.0.0
git push origin v1.0.0

# Or create release via GitHub web interface
# Include:
# - Release notes
# - Binary attachments (if any)
# - Link to npm package
```

### 3. Promote the Package

```bash
# Add npm badges to README.md
[![npm version](https://badge.fury.io/js/jmeter-style-reporter.svg)](https://badge.fury.io/js/jmeter-style-reporter)
[![npm downloads](https://img.shields.io/npm/dm/jmeter-style-reporter.svg)](https://www.npmjs.com/package/jmeter-style-reporter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Update package description on npm website
# Create blog post or announcement
# Share on social media, forums, communities
```

## Maintenance and Updates

### 1. Regular Updates

```bash
# Update dependencies
npm update
npm audit fix

# Update dev dependencies
npm update --dev

# Check for outdated packages
npm outdated
```

### 2. Publishing Updates

```bash
# For bug fixes
npm version patch
npm publish

# For new features
npm version minor
npm publish

# For breaking changes
npm version major
npm publish
```

### 3. Deprecation (if needed)

```bash
# Deprecate a version
npm deprecate jmeter-style-reporter@1.0.0 "Please upgrade to 1.0.1"

# Deprecate all versions (package retirement)
npm deprecate jmeter-style-reporter "Package no longer maintained"
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Package Name Already Exists
```bash
# Solution: Use scoped package
npm init --scope=@yourusername
# Update package.json name to "@yourusername/jmeter-style-reporter"
```

#### 2. Authentication Issues
```bash
# Re-login to npm
npm logout
npm login

# Check authentication
npm whoami
npm config get registry
```

#### 3. Build Failures
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 4. File Size Issues
```bash
# Check bundle size
npm run size

# Analyze bundle
npm run build -- --metafile
npx esbuild-visualizer --metadata dist/metafile.json
```

#### 5. TypeScript Declaration Issues
```bash
# Check TypeScript compilation
npm run typecheck

# Generate declarations separately
npx tsc --declaration --emitDeclarationOnly --outDir dist/types
```

#### 6. CLI Binary Issues
```bash
# Make CLI executable
chmod +x dist/cli.js

# Test CLI directly
node dist/cli.js --help

# Check shebang line
head -1 dist/cli.js  # Should be #!/usr/bin/env node
```

### Pre-publish Checklist

- [ ] Package name is available and appropriate
- [ ] Version number follows semantic versioning
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Bundle size is acceptable (`npm run size`)
- [ ] CLI works correctly
- [ ] Documentation is up to date
- [ ] CHANGELOG is updated
- [ ] LICENSE file exists
- [ ] .npmignore excludes unnecessary files
- [ ] package.json metadata is complete
- [ ] Local testing passes
- [ ] Ready for public use

### Publishing Commands Summary

```bash
# Development workflow
npm run build:check
npm test
npm run lint

# Version and publish
npm version patch  # or minor/major
npm publish

# Verify
npm view jmeter-style-reporter
npm install -g jmeter-style-reporter@latest
jmeter-style-reporter --version
```

This guide ensures a smooth and professional npm publishing process for your JMeter Style Reporter package.