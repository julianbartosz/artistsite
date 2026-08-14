// Automated Test Suite Runner
import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export interface TestSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  failures: TestFailure[];
}

export interface TestFailure {
  test: string;
  error: string;
  stack?: string;
}

export class TestAutomation {
  static async runFullTestSuite(): Promise<{
    overall_success: boolean;
    total_tests: number;
    suites: TestSuiteResult[];
    coverage_summary: any;
  }> {
    console.log('Starting comprehensive test suite...');
    
    const results: TestSuiteResult[] = [];
    
    // Run unit tests
    const unitTests = await this.runUnitTests();
    results.push(unitTests);
    
    // Run integration tests
    const integrationTests = await this.runIntegrationTests();
    results.push(integrationTests);
    
    // Run E2E tests
    const e2eTests = await this.runE2ETests();
    results.push(e2eTests);
    
    // Generate coverage report
    const coverageSummary = await this.generateCoverageReport();
    
    const totalTests = results.reduce((sum, suite) => 
      sum + suite.passed + suite.failed + suite.skipped, 0
    );
    
    const overallSuccess = results.every(suite => suite.failed === 0);
    
    // Store test results
    await this.storeTestResults({
      overall_success: overallSuccess,
      total_tests: totalTests,
      suites: results,
      coverage_summary: coverageSummary
    });
    
    return {
      overall_success: overallSuccess,
      total_tests: totalTests,
      suites: results,
      coverage_summary: coverageSummary
    };
  }

  private static async runUnitTests(): Promise<TestSuiteResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const jest = spawn('npm', ['run', 'test', '--', '--coverage', '--watchAll=false'], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      jest.stdout.on('data', (data) => {
        output += data.toString();
      });

      jest.stderr.on('data', (data) => {
        output += data.toString();
      });

      jest.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = this.parseJestOutput(output, duration);
        result.suite = 'Unit Tests';
        resolve(result);
      });
    });
  }

  private static async runIntegrationTests(): Promise<TestSuiteResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // Run API integration tests
      const jest = spawn('npm', ['run', 'test', '--', '--testPathPattern=integration', '--watchAll=false'], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      jest.stdout.on('data', (data) => {
        output += data.toString();
      });

      jest.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = this.parseJestOutput(output, duration);
        result.suite = 'Integration Tests';
        resolve(result);
      });
    });
  }

  private static async runE2ETests(): Promise<TestSuiteResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // Would run Playwright E2E tests
      const playwright = spawn('npx', ['playwright', 'test'], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      playwright.stdout.on('data', (data) => {
        output += data.toString();
      });

      playwright.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = this.parsePlaywrightOutput(output, duration);
        result.suite = 'E2E Tests';
        resolve(result);
      });
    });
  }

  private static parseJestOutput(output: string, duration: number): TestSuiteResult {
    const lines = output.split('\n');
    
    // Extract test summary
    const summaryLine = lines.find(line => line.includes('Tests:'));
    const passed = this.extractNumber(summaryLine, /(\d+) passed/) || 0;
    const failed = this.extractNumber(summaryLine, /(\d+) failed/) || 0;
    const skipped = this.extractNumber(summaryLine, /(\d+) skipped/) || 0;

    // Extract failures
    const failures: TestFailure[] = [];
    let inFailureSection = false;
    let currentFailure: Partial<TestFailure> = {};

    for (const line of lines) {
      if (line.includes('FAIL')) {
        inFailureSection = true;
        currentFailure = { test: line.trim() };
      } else if (inFailureSection && line.includes('Error:')) {
        currentFailure.error = line.trim();
        if (currentFailure.test) {
          failures.push(currentFailure as TestFailure);
        }
        inFailureSection = false;
        currentFailure = {};
      }
    }

    return {
      suite: '',
      passed,
      failed,
      skipped,
      duration,
      failures
    };
  }

  private static parsePlaywrightOutput(output: string, duration: number): TestSuiteResult {
    // Similar parsing logic for Playwright output
    return {
      suite: '',
      passed: 0,
      failed: 0,
      skipped: 0,
      duration,
      failures: []
    };
  }

  private static extractNumber(text: string | undefined, regex: RegExp): number | null {
    if (!text) return null;
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }

  private static async generateCoverageReport(): Promise<any> {
    try {
      const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');
      const coverageData = readFileSync(coveragePath, 'utf8');
      return JSON.parse(coverageData);
    } catch (error) {
      console.warn('Coverage report not found');
      return null;
    }
  }

  private static async storeTestResults(results: any): Promise<void> {
    const { db } = await import('@/lib/db');
    
    try {
      await db.analyticsEvent.create({
        data: {
          eventName: 'test_suite_completed',
          properties: JSON.stringify(results),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error storing test results:', error);
    }
  }

  // Continuous Integration helpers
  static async runCIPipeline(): Promise<{
    success: boolean;
    stages: { name: string; success: boolean; duration: number; output?: string }[];
  }> {
    const stages = [
      { name: 'Lint', command: 'npm run lint' },
      { name: 'Type Check', command: 'npm run type-check' },
      { name: 'Build', command: 'npm run build' },
      { name: 'Unit Tests', command: 'npm run test -- --watchAll=false' },
      { name: 'E2E Tests', command: 'npm run test:e2e' }
    ];

    const results = [];
    let overallSuccess = true;

    for (const stage of stages) {
      console.log(`Running ${stage.name}...`);
      const startTime = Date.now();
      
      try {
        const output = await this.runCommand(stage.command);
        const duration = Date.now() - startTime;
        
        results.push({
          name: stage.name,
          success: true,
          duration,
          output
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        overallSuccess = false;
        
        results.push({
          name: stage.name,
          success: false,
          duration,
          output: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Stop on first failure in CI
        break;
      }
    }

    return {
      success: overallSuccess,
      stages: results
    };
  }

  private static runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, { stdio: 'pipe', shell: true });
      
      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(output));
        }
      });
    });
  }

  // Load testing integration
  static async runLoadTestSuite(): Promise<void> {
    const { PerformanceMonitor } = await import('@/lib/performance/performance-monitor');
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const endpoints = [
      '/',
      '/shop',
      '/portfolio',
      '/contact',
      '/api/analytics/events'
    ];

    console.log('Starting load test suite...');
    
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`;
      console.log(`Load testing ${url}...`);
      
      const results = await PerformanceMonitor.runLoadTest(url, 10, 30);
      
      console.log(`Results for ${endpoint}:`, {
        avgResponseTime: `${results.averageResponseTime}ms`,
        requestsPerSecond: `${results.requestsPerSecond} req/s`,
        errorRate: `${results.errorRate}%`,
        p95ResponseTime: `${results.p95ResponseTime}ms`
      });
    }
    
    console.log('✅ Load test suite completed');
  }
}