import { performanceMonitor } from './performance-monitor'
import { logger } from '@/lib/logger'

export interface BenchmarkConfig {
  name: string
  description?: string
  duration: number // seconds
  concurrency: number
  rampUpTime?: number // seconds
  targetUrl: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  expectedStatusCodes?: number[]
}

export interface BenchmarkResult {
  config: BenchmarkConfig
  startTime: Date
  endTime: Date
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerSecond: number
  errorRate: number
  throughput: number // bytes per second
  statusCodeDistribution: Record<number, number>
  errors: Array<{ message: string; count: number }>
}

export interface LoadTestScenario {
  name: string
  description?: string
  steps: Array<{
    duration: number
    concurrency: number
    config: Partial<BenchmarkConfig>
  }>
}

export class BenchmarkingTools {
  private static instance: BenchmarkingTools
  private activeBenchmarks: Map<string, { abortController: AbortController; promise: Promise<BenchmarkResult> }> = new Map()

  static getInstance(): BenchmarkingTools {
    if (!BenchmarkingTools.instance) {
      BenchmarkingTools.instance = new BenchmarkingTools()
    }
    return BenchmarkingTools.instance
  }

  /**
   * Run a performance benchmark
   */
  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const benchmarkId = `benchmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const abortController = new AbortController()

    this.activeBenchmarks.set(benchmarkId, {
      abortController,
      promise: this.executeBenchmark(config, abortController.signal)
    })

    try {
      const result = await this.activeBenchmarks.get(benchmarkId)!.promise
      this.activeBenchmarks.delete(benchmarkId)
      return result
    } catch (error) {
      this.activeBenchmarks.delete(benchmarkId)
      throw error
    }
  }

  /**
   * Run a load test scenario with multiple steps
   */
  async runLoadTest(scenario: LoadTestScenario): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []

    for (const step of scenario.steps) {
      logger.info('Starting load test step', {
        scenario: scenario.name,
        step: step,
        concurrency: step.concurrency,
        duration: step.duration
      })

      const config: BenchmarkConfig = {
        name: `${scenario.name}_step_${step.concurrency}`,
        description: scenario.description,
        duration: step.duration,
        concurrency: step.concurrency,
        targetUrl: step.config.targetUrl || 'http://localhost:3000',
        method: step.config.method || 'GET',
        headers: step.config.headers,
        body: step.config.body,
        expectedStatusCodes: step.config.expectedStatusCodes || [200]
      }

      const result = await this.runBenchmark(config)
      results.push(result)

      // Brief pause between steps
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return results
  }

  /**
   * Stop a running benchmark
   */
  stopBenchmark(benchmarkId: string): boolean {
    const benchmark = this.activeBenchmarks.get(benchmarkId)
    if (benchmark) {
      benchmark.abortController.abort()
      this.activeBenchmarks.delete(benchmarkId)
      logger.info('Benchmark stopped', { benchmarkId })
      return true
    }
    return false
  }

  /**
   * Get list of active benchmarks
   */
  getActiveBenchmarks(): string[] {
    return Array.from(this.activeBenchmarks.keys())
  }

  /**
   * Generate a stress test configuration
   */
  generateStressTestConfig(targetUrl: string, maxConcurrency: number = 100): BenchmarkConfig {
    return {
      name: 'stress_test',
      description: 'High concurrency stress test',
      duration: 60, // 1 minute
      concurrency: maxConcurrency,
      rampUpTime: 10,
      targetUrl,
      method: 'GET',
      expectedStatusCodes: [200, 429, 500, 502, 503, 504]
    }
  }

  /**
   * Generate a spike test configuration
   */
  generateSpikeTestConfig(targetUrl: string, spikeConcurrency: number = 500): BenchmarkConfig {
    return {
      name: 'spike_test',
      description: 'Sudden traffic spike test',
      duration: 30, // 30 seconds
      concurrency: spikeConcurrency,
      rampUpTime: 2, // Quick ramp up
      targetUrl,
      method: 'GET',
      expectedStatusCodes: [200, 429, 500, 502, 503, 504]
    }
  }

  /**
   * Generate a volume test configuration
   */
  generateVolumeTestConfig(targetUrl: string, duration: number = 300): BenchmarkConfig {
    return {
      name: 'volume_test',
      description: 'Sustained load volume test',
      duration,
      concurrency: 50,
      rampUpTime: 30,
      targetUrl,
      method: 'GET',
      expectedStatusCodes: [200]
    }
  }

  // Private methods

  private async executeBenchmark(config: BenchmarkConfig, signal: AbortSignal): Promise<BenchmarkResult> {
    const startTime = new Date()
    const responseTimes: number[] = []
    const statusCodeDistribution: Record<number, number> = {}
    const errors: Array<{ message: string; count: number }> = []
    let totalRequests = 0
    let successfulRequests = 0
    let failedRequests = 0
    let totalBytesTransferred = 0

    logger.info('Starting benchmark', {
      name: config.name,
      targetUrl: config.targetUrl,
      concurrency: config.concurrency,
      duration: config.duration
    })

    try {
      // Create worker pool
      const workers = Array.from({ length: config.concurrency }, (_, i) =>
        this.createWorker(config, signal, i)
      )

      // Execute benchmark
      const results = await Promise.allSettled(workers)

      // Aggregate results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const workerResult = result.value
          totalRequests += workerResult.requests
          successfulRequests += workerResult.successfulRequests
          failedRequests += workerResult.failedRequests
          responseTimes.push(...workerResult.responseTimes)
          totalBytesTransferred += workerResult.bytesTransferred

          // Merge status code distribution
          Object.entries(workerResult.statusCodes).forEach(([code, count]) => {
            statusCodeDistribution[parseInt(code)] = (statusCodeDistribution[parseInt(code)] || 0) + count
          })

          // Merge errors
          workerResult.errors.forEach(error => {
            const existingError = errors.find(e => e.message === error.message)
            if (existingError) {
              existingError.count += error.count
            } else {
              errors.push({ ...error })
            }
          })
        }
      }

    } catch (error) {
      logger.error('Benchmark execution failed', { error, config: config.name })
      throw error
    }

    const endTime = new Date()
    const duration = (endTime.getTime() - startTime.getTime()) / 1000

    // Calculate statistics
    const sortedResponseTimes = responseTimes.sort((a, b) => a - b)
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0

    const minResponseTime = responseTimes.length > 0 ? sortedResponseTimes[0] : 0
    const maxResponseTime = responseTimes.length > 0 ? sortedResponseTimes[sortedResponseTimes.length - 1] : 0

    const p95Index = Math.floor(sortedResponseTimes.length * 0.95)
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99)

    const p95ResponseTime = sortedResponseTimes[p95Index] || maxResponseTime
    const p99ResponseTime = sortedResponseTimes[p99Index] || maxResponseTime

    const requestsPerSecond = totalRequests / duration
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0
    const throughput = totalBytesTransferred / duration

    const benchmarkResult: BenchmarkResult = {
      config,
      startTime,
      endTime,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      requestsPerSecond,
      errorRate,
      throughput,
      statusCodeDistribution,
      errors
    }

    // Record benchmark metrics
    await this.recordBenchmarkMetrics(benchmarkResult)

    logger.info('Benchmark completed', {
      name: config.name,
      totalRequests,
      requestsPerSecond: requestsPerSecond.toFixed(2),
      averageResponseTime: averageResponseTime.toFixed(2),
      errorRate: errorRate.toFixed(2)
    })

    return benchmarkResult
  }

  private async createWorker(
    config: BenchmarkConfig,
    signal: AbortSignal,
    workerId: number
  ): Promise<{
    requests: number
    successfulRequests: number
    failedRequests: number
    responseTimes: number[]
    statusCodes: Record<number, number>
    errors: Array<{ message: string; count: number }>
    bytesTransferred: number
  }> {
    let requests = 0
    let successfulRequests = 0
    let failedRequests = 0
    const responseTimes: number[] = []
    const statusCodes: Record<number, number> = {}
    const errors: Array<{ message: string; count: number }> = []
    let bytesTransferred = 0

    const endTime = Date.now() + (config.duration * 1000)

    while (Date.now() < endTime && !signal.aborted) {
      const startTime = Date.now()

      try {
        const response = await this.makeRequest(config)
        const responseTime = Date.now() - startTime

        requests++
        responseTimes.push(responseTime)

        if (config.expectedStatusCodes?.includes(response.status)) {
          successfulRequests++
        } else {
          failedRequests++
        }

        statusCodes[response.status] = (statusCodes[response.status] || 0) + 1

        // Estimate bytes transferred
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          bytesTransferred += parseInt(contentLength)
        } else {
          bytesTransferred += 1024 // Estimate 1KB if not specified
        }

      } catch (error: any) {
        requests++
        failedRequests++

        const errorMessage = error.message || 'Unknown error'
        const existingError = errors.find(e => e.message === errorMessage)
        if (existingError) {
          existingError.count++
        } else {
          errors.push({ message: errorMessage, count: 1 })
        }
      }

      // Small delay to prevent overwhelming the target
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    return {
      requests,
      successfulRequests,
      failedRequests,
      responseTimes,
      statusCodes,
      errors,
      bytesTransferred
    }
  }

  private async makeRequest(config: BenchmarkConfig): Promise<Response> {
    const headers: Record<string, string> = {
      'User-Agent': 'BenchmarkingTools/1.0',
      ...config.headers
    }

    const requestInit: RequestInit = {
      method: config.method,
      headers
    }

    if (config.body && (config.method === 'POST' || config.method === 'PUT')) {
      if (typeof config.body === 'object') {
        requestInit.body = JSON.stringify(config.body)
        headers['Content-Type'] = 'application/json'
      } else {
        requestInit.body = config.body
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch(config.targetUrl, {
        ...requestInit,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private async recordBenchmarkMetrics(result: BenchmarkResult): Promise<void> {
    const timestamp = result.endTime.toISOString()

    // Record throughput
    await performanceMonitor.recordThroughputMetric(
      result.requestsPerSecond,
      timestamp,
      result.config.name
    )

    // Record response time percentiles
    await performanceMonitor.recordNetworkLatency(
      result.p95ResponseTime,
      'benchmark_p95',
      timestamp
    )

    await performanceMonitor.recordNetworkLatency(
      result.p99ResponseTime,
      'benchmark_p99',
      timestamp
    )

    // Record error rate
    await performanceMonitor.recordErrorRate(
      result.failedRequests,
      result.totalRequests,
      result.config.duration,
      timestamp
    )
  }

  /**
   * Generate benchmark report
   */
  generateReport(results: BenchmarkResult[]): string {
    let report = '# Performance Benchmark Report\n\n'

    results.forEach((result, index) => {
      report += `## Benchmark ${index + 1}: ${result.config.name}\n\n`
      report += `**Description:** ${result.config.description || 'N/A'}\n\n`
      report += `**Target:** ${result.config.targetUrl}\n`
      report += `**Method:** ${result.config.method}\n`
      report += `**Concurrency:** ${result.config.concurrency}\n`
      report += `**Duration:** ${result.config.duration}s\n\n`

      report += '### Results\n\n'
      report += `- **Total Requests:** ${result.totalRequests.toLocaleString()}\n`
      report += `- **Successful Requests:** ${result.successfulRequests.toLocaleString()}\n`
      report += `- **Failed Requests:** ${result.failedRequests.toLocaleString()}\n`
      report += `- **Requests/Second:** ${result.requestsPerSecond.toFixed(2)}\n`
      report += `- **Average Response Time:** ${result.averageResponseTime.toFixed(2)}ms\n`
      report += `- **95th Percentile:** ${result.p95ResponseTime.toFixed(2)}ms\n`
      report += `- **99th Percentile:** ${result.p99ResponseTime.toFixed(2)}ms\n`
      report += `- **Error Rate:** ${result.errorRate.toFixed(2)}%\n`
      report += `- **Throughput:** ${(result.throughput / 1024).toFixed(2)} KB/s\n\n`

      if (result.errors.length > 0) {
        report += '### Errors\n\n'
        result.errors.forEach(error => {
          report += `- ${error.message}: ${error.count} occurrences\n`
        })
        report += '\n'
      }

      report += '### Status Code Distribution\n\n'
      Object.entries(result.statusCodeDistribution).forEach(([code, count]) => {
        report += `- ${code}: ${count} requests\n`
      })
      report += '\n---\n\n'
    })

    return report
  }
}

// Export singleton instance
export const benchmarkingTools = BenchmarkingTools.getInstance()