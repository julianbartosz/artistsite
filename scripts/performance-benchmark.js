#!/usr/bin/env node

/**
 * Performance Benchmarking Script for CI/CD Pipeline
 * Tests critical performance metrics and validates deployment quality
 */

const { performance } = require('perf_hooks');
const http = require('http');
const https = require('https');

// Configuration
const config = {
  baseUrl: process.env.BENCHMARK_URL || 'http://localhost:3000',
  timeout: 10000,
  iterations: 10,
  concurrency: 5,
  thresholds: {
    responseTime: 2000, // ms
    memoryUsage: 100, // MB
    errorRate: 5, // %
    availability: 99, // %
  }
};

// Test scenarios
const testScenarios = [
  { name: 'Homepage', path: '/', method: 'GET' },
  { name: 'Blog', path: '/blog', method: 'GET' },
  { name: 'Portfolio', path: '/portfolio', method: 'GET' },
  { name: 'Shop', path: '/shop', method: 'GET' },
  { name: 'Health Check', path: '/api/health', method: 'GET' },
  { name: 'Newsletter Signup', path: '/api/newsletter', method: 'POST', 
    body: JSON.stringify({ email: 'test@example.com', consent: true }),
    headers: { 'Content-Type': 'application/json' } }
];

class PerformanceBenchmark {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  async runBenchmark() {
    console.log('🚀 Starting Performance Benchmark');
    console.log(`Base URL: ${config.baseUrl}`);
    console.log(`Iterations: ${config.iterations}, Concurrency: ${config.concurrency}`);
    console.log('─'.repeat(60));

    // Wait for service to be ready
    await this.waitForService();

    // Run baseline health check
    const healthCheck = await this.checkHealth();
    if (!healthCheck.success) {
      console.error('❌ Service health check failed - aborting benchmark');
      process.exit(1);
    }

    // Run performance tests for each scenario
    for (const scenario of testScenarios) {
      await this.runScenario(scenario);
    }

    // Generate report
    const report = this.generateReport();
    this.printReport(report);

    // Check if benchmarks pass thresholds
    const passed = this.validateThresholds(report);
    process.exit(passed ? 0 : 1);
  }

  async waitForService() {
    const maxRetries = 30;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await this.makeRequest('/api/health', 'GET');
        console.log('✅ Service is ready');
        return;
      } catch (error) {
        retries++;
        console.log(`⏳ Waiting for service... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Service did not become ready in time');
  }

  async checkHealth() {
    try {
      const response = await this.makeRequest('/api/health', 'GET');
      const data = JSON.parse(response.body);
      
      return {
        success: response.statusCode === 200,
        status: data.status,
        responseTime: response.responseTime,
        memory: data.memory
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async runScenario(scenario) {
    console.log(`\n📊 Testing: ${scenario.name}`);
    
    const results = [];
    const errors = [];

    // Run sequential iterations
    for (let i = 0; i < config.iterations; i++) {
      try {
        const result = await this.makeRequest(
          scenario.path, 
          scenario.method, 
          scenario.body,
          scenario.headers
        );
        results.push(result);
      } catch (error) {
        errors.push(error);
      }
    }

    // Run concurrent test
    const concurrentResults = await this.runConcurrentTest(scenario);
    
    const scenarioResult = {
      name: scenario.name,
      path: scenario.path,
      sequential: this.analyzeResults(results),
      concurrent: this.analyzeResults(concurrentResults.results),
      errors: errors.length + concurrentResults.errors.length,
      totalRequests: config.iterations + config.concurrency
    };

    this.results.push(scenarioResult);
    this.printScenarioResult(scenarioResult);
  }

  async runConcurrentTest(scenario) {
    const promises = [];
    for (let i = 0; i < config.concurrency; i++) {
      promises.push(this.makeRequest(
        scenario.path, 
        scenario.method, 
        scenario.body,
        scenario.headers
      ).catch(err => ({ error: err })));
    }

    const results = await Promise.all(promises);
    const validResults = results.filter(r => !r.error);
    const errors = results.filter(r => r.error);

    return { results: validResults, errors };
  }

  async makeRequest(path, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, config.baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'User-Agent': 'Performance-Benchmark/1.0',
          ...headers
        },
        timeout: config.timeout
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const startTime = performance.now();
      
      const req = client.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          resolve({
            statusCode: res.statusCode,
            responseTime: Math.round(responseTime),
            body: responseBody,
            headers: res.headers,
            size: Buffer.byteLength(responseBody)
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  analyzeResults(results) {
    if (results.length === 0) return null;

    const responseTimes = results.map(r => r.responseTime);
    const sizes = results.map(r => r.size);
    const successCount = results.filter(r => r.statusCode >= 200 && r.statusCode < 400).length;

    return {
      count: results.length,
      successRate: (successCount / results.length) * 100,
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        p95: this.percentile(responseTimes, 95)
      },
      throughput: results.length / (Math.max(...responseTimes) / 1000),
      avgSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)
    };
  }

  percentile(values, p) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  generateReport() {
    const overallStats = {
      totalScenarios: this.results.length,
      totalRequests: this.results.reduce((sum, r) => sum + r.totalRequests, 0),
      totalErrors: this.results.reduce((sum, r) => sum + r.errors, 0),
      avgResponseTime: 0,
      maxResponseTime: 0,
      successRate: 0
    };

    let totalResponseTime = 0;
    let totalRequests = 0;
    let totalSuccessful = 0;

    this.results.forEach(result => {
      if (result.sequential) {
        totalResponseTime += result.sequential.responseTime.avg * result.sequential.count;
        totalRequests += result.sequential.count;
        totalSuccessful += Math.round((result.sequential.successRate / 100) * result.sequential.count);
        overallStats.maxResponseTime = Math.max(overallStats.maxResponseTime, result.sequential.responseTime.max);
      }
    });

    overallStats.avgResponseTime = Math.round(totalResponseTime / totalRequests);
    overallStats.successRate = Math.round((totalSuccessful / totalRequests) * 100);

    return overallStats;
  }

  printScenarioResult(result) {
    if (result.sequential) {
      console.log(`  ✓ Avg Response: ${result.sequential.responseTime.avg}ms`);
      console.log(`  ✓ Success Rate: ${result.sequential.successRate.toFixed(1)}%`);
      console.log(`  ✓ P95: ${result.sequential.responseTime.p95}ms`);
    }
    if (result.errors > 0) {
      console.log(`  ⚠️  Errors: ${result.errors}`);
    }
  }

  printReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(60));
    console.log(`Total Scenarios: ${report.totalScenarios}`);
    console.log(`Total Requests: ${report.totalRequests}`);
    console.log(`Total Errors: ${report.totalErrors}`);
    console.log(`Average Response Time: ${report.avgResponseTime}ms`);
    console.log(`Max Response Time: ${report.maxResponseTime}ms`);
    console.log(`Overall Success Rate: ${report.successRate}%`);
    console.log('='.repeat(60));
  }

  validateThresholds(report) {
    const checks = [
      {
        name: 'Average Response Time',
        value: report.avgResponseTime,
        threshold: config.thresholds.responseTime,
        unit: 'ms',
        operator: '≤'
      },
      {
        name: 'Success Rate',
        value: report.successRate,
        threshold: config.thresholds.availability,
        unit: '%',
        operator: '≥'
      },
      {
        name: 'Error Rate',
        value: (report.totalErrors / report.totalRequests) * 100,
        threshold: config.thresholds.errorRate,
        unit: '%',
        operator: '≤'
      }
    ];

    console.log('\n🎯 THRESHOLD VALIDATION');
    console.log('─'.repeat(60));

    let allPassed = true;
    checks.forEach(check => {
      const passed = check.operator === '≤' 
        ? check.value <= check.threshold 
        : check.value >= check.threshold;
      
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.value}${check.unit} ${check.operator} ${check.threshold}${check.unit}`);
      
      if (!passed) allPassed = false;
    });

    console.log('─'.repeat(60));
    console.log(allPassed ? '🎉 All thresholds passed!' : '💥 Some thresholds failed!');
    
    return allPassed;
  }
}

// Run benchmark if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runBenchmark().catch(error => {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  });
}

module.exports = PerformanceBenchmark;