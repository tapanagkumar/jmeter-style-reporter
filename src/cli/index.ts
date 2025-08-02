#!/usr/bin/env node

/**
 * JMeter Style Reporter CLI
 */

import { generateReport, createCollector } from '../index'

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
JMeter Style Reporter v1.2.0

Usage:
  jmeter-style-reporter <command> [options]

Commands:
  report <csv-file>     Generate HTML report from CSV file
  collect <output>      Start collecting performance data
  --help, -h           Show this help message
  --version, -v        Show version

Examples:
  jmeter-style-reporter report ./data.csv
  jmeter-style-reporter report ./data.csv --output ./reports --title "My Test"
  jmeter-style-reporter collect ./metrics.csv

Options:
  --output, -o <dir>   Output directory (default: ./jmeter-report)
  --title, -t <title>  Report title
  --theme <theme>      Theme: light, dark, auto (default: auto)
  --jenkins            Generate Jenkins-compatible report (no external dependencies)
  --embedded-charts    Use embedded charts instead of CDN
`)
    process.exit(0)
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('1.2.0')
    process.exit(0)
  }

  const command = args[0]

  try {
    if (command === 'report') {
      const csvFile = args[1]
      if (!csvFile) {
        console.error('❌ Error: CSV file path is required')
        console.log('Usage: jmeter-style-reporter report <csv-file>')
        process.exit(1)
      }

      const outputIndex = args.indexOf('--output') || args.indexOf('-o')
      const titleIndex = args.indexOf('--title') || args.indexOf('-t')
      const themeIndex = args.indexOf('--theme')
      const jenkinsFlag = args.includes('--jenkins')
      const embeddedChartsFlag = args.includes('--embedded-charts')

      const themeValue = themeIndex > -1 ? args[themeIndex + 1] : 'auto'
      const validThemes = ['light', 'dark', 'auto']
      let theme = 'auto'
      if (validThemes.includes(themeValue)) {
        theme = themeValue
      }
      
      const options = {
        csv: csvFile,
        output: outputIndex > -1 ? args[outputIndex + 1] : './jmeter-report',
        title: titleIndex > -1 ? args[titleIndex + 1] : 'Performance Report',
        theme: theme,
        jenkinsCompatible: jenkinsFlag,
        embeddedCharts: embeddedChartsFlag
      }

      console.log('🚀 Generating performance report...')
      console.log(`📊 Input: ${csvFile}`)
      console.log(`📁 Output: ${options.output}`)

      const result = await generateReport(options)

      console.log('\n✅ Report generated successfully!')
      console.log(`📈 Report URL: ${result.reportUrl}`)
      console.log(`📊 Total Requests: ${result.summary.totalRequests}`)
      console.log(`⏱️  Average Response Time: ${result.summary.averageResponseTime?.toFixed(2)}ms`)
      console.log(`❌ Error Rate: ${(result.summary.errorRate * 100).toFixed(2)}%`)
      console.log('\n💡 Open the report in your browser to view detailed charts and analysis.')

    } else if (command === 'collect') {
      const outputFile = args[1]
      if (!outputFile) {
        console.error('❌ Error: Output file path is required')
        console.log('Usage: jmeter-style-reporter collect <output-file>')
        process.exit(1)
      }

      console.log('📊 Starting performance data collection...')
      console.log(`📁 Output: ${outputFile}`)
      console.log('Press Ctrl+C to stop and generate report')

      const collector = createCollector({
        outputPath: outputFile,
        testName: 'CLI Collection',
      })

      // Demo: Generate some sample data
      console.log('📈 Generating sample performance data...')
      
      for (let i = 0; i < 50; i++) {
        await collector.recordMetric({
          endpoint: `/api/endpoint-${i % 5}`,
          responseTime: Math.random() * 500 + 50,
          statusCode: Math.random() > 0.1 ? 200 : 500,
          method: 'GET'
        })
        
        if (i % 10 === 0) {
          process.stdout.write(`📊 Generated ${i + 1}/50 metrics\r`)
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      await collector.flush()
      console.log('\n✅ Sample data collection completed!')
      console.log(`📊 Data saved to: ${outputFile}`)
      console.log('\n💡 Generate a report with:')
      console.log(`   jmeter-style-reporter report ${outputFile}`)

    } else {
      console.error(`❌ Unknown command: ${command}`)
      console.log('Run "jmeter-style-reporter --help" for usage information')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})