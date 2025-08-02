/**
 * JMeter Style Reporter - Main Entry Point
 * A unified performance testing and reporting system
 * 
 * This module provides backward compatibility while offering enhanced features.
 * For new projects, consider using the enhanced APIs from './jmeter-reporter'
 */

// Re-export enhanced implementations with backward compatibility
export {
  // Enhanced types
  PerformanceMetric,
  CollectorOptions,
  ReportOptions,
  ReportResult,
  
  // Enhanced implementations
  JMeterPerformanceCollector,
  StatisticsCalculator,
  createCollector,
  generateJMeterReport,
  performanceMiddleware,
} from './jmeter-reporter'

// Legacy aliases for backward compatibility
export { generateJMeterReport as generateReport } from './jmeter-reporter'

// Legacy class name alias
export { JMeterPerformanceCollector as PerformanceCollector } from './jmeter-reporter'

// Default export for compatibility
export { default } from './jmeter-reporter'