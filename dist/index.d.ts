/**
 * Enhanced JMeter Style Reporter
 * Provides comprehensive performance testing and reporting with JMeter compatibility
 */
interface PerformanceMetric {
    endpoint?: string;
    responseTime?: number;
    statusCode?: number;
    method?: string;
    timestamp?: number;
    success?: boolean;
    testName?: string;
    bytes?: number;
    sentBytes?: number;
    grpThreads?: number;
    allThreads?: number;
    customFields?: Record<string, any>;
}
interface CollectorOptions {
    outputPath: string;
    testName?: string;
    bufferSize?: number;
    flushInterval?: number;
    silent?: boolean;
    onFlush?: (count: number) => void;
    onError?: (error: Error) => void;
    jmeterCompatible?: boolean;
}
interface ReportOptions {
    csv: string | string[];
    output?: string;
    title?: string;
    theme?: 'light' | 'dark' | 'auto';
    includePercentiles?: boolean;
    includeApdex?: boolean;
    apdexThreshold?: number;
    includeDrillDown?: boolean;
    apiVersion?: '1.0' | '1.1' | 'latest';
    maxMemoryUsageMB?: number;
    streamingMode?: boolean;
    maxDataPoints?: number;
    skipDataValidation?: boolean;
    jenkinsCompatible?: boolean;
    embeddedCharts?: boolean;
}
interface ReportResult {
    outputPath: string;
    reportUrl: string;
    summary: {
        totalRequests: number;
        averageResponseTime?: number;
        errorRate: number;
        throughput: number;
        percentiles?: {
            p50: number;
            p90: number;
            p95: number;
            p99: number;
        };
        apdexScore?: number;
    };
    warnings: string[];
    stats: {
        memoryUsedMB: number;
        processingTimeMs: number;
        recordsProcessed: number;
        recordsSkipped: number;
    };
}
interface ApdexData {
    label: string;
    score: number;
    samples: number;
    satisfied: number;
    tolerating: number;
    frustrated: number;
}
/**
 * Enhanced Performance Collector with JMeter compatibility
 */
declare class JMeterPerformanceCollector {
    private metrics;
    private options;
    private flushTimer?;
    private disposed;
    private readonly maxMetrics;
    private flushing;
    private pendingFlush;
    private totalMetricsCollected;
    private totalMetricsFlushed;
    private errorCount;
    private flushCount;
    private readonly startTime;
    private dataIntegrityHash;
    constructor(options: CollectorOptions);
    recordMetric(metric: Partial<PerformanceMetric>): Promise<void>;
    private updateDataIntegrityHash;
    getStats(): {
        totalMetrics: number;
        bufferedMetrics: number;
        flushCount: number;
        errorCount: number;
        isActive: boolean;
        startTime: number;
        lastFlushTime: number;
        dataIntegrityHash: string;
    };
    flush(): Promise<void>;
    private _performFlush;
    dispose(): Promise<void>;
}
/**
 * Statistical calculation utilities
 */
declare class StatisticsCalculator {
    static calculatePercentile(values: number[], percentile: number): number;
    static calculateApdexScore(responseTimes: number[], threshold?: number, label?: string): ApdexData;
    static calculateStandardDeviation(values: number[], mean: number): number;
}
/**
 * Legacy API support for v1.0 compatibility
 */
interface LegacyCollectorOptions {
    outputPath: string;
    testName?: string;
    bufferSize?: number;
    flushInterval?: number;
    silent?: boolean;
    onFlush?: (count: number) => void;
    onError?: (error: Error) => void;
}
/**
 * Create performance collector with enhanced features
 */
declare function createCollector(options: CollectorOptions | LegacyCollectorOptions): JMeterPerformanceCollector;
/**
 * Enhanced memory-safe streaming report generation
 */
declare function generateJMeterReport(options: ReportOptions): Promise<ReportResult>;
/**
 * Express middleware for performance monitoring
 */
interface MiddlewareOptions {
    includeQuery?: boolean;
    skipPaths?: RegExp[];
    customLabels?: (req: any) => Record<string, any>;
    collector?: JMeterPerformanceCollector;
}
declare function performanceMiddleware(collectorOrOptions: JMeterPerformanceCollector | MiddlewareOptions, options?: MiddlewareOptions): (req: any, res: any, next: any) => any;
declare const _default: {
    createCollector: typeof createCollector;
    generateJMeterReport: typeof generateJMeterReport;
    performanceMiddleware: typeof performanceMiddleware;
    JMeterPerformanceCollector: typeof JMeterPerformanceCollector;
    StatisticsCalculator: typeof StatisticsCalculator;
};

export { type CollectorOptions, JMeterPerformanceCollector, JMeterPerformanceCollector as PerformanceCollector, type PerformanceMetric, type ReportOptions, type ReportResult, StatisticsCalculator, createCollector, _default as default, generateJMeterReport, generateJMeterReport as generateReport, performanceMiddleware };
