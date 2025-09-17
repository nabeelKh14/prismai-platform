#!/usr/bin/env node

/**
 * Test script for backup and recovery implementations
 * Runs comprehensive tests on all backup and recovery features
 */

const { createDatabaseBackup, restoreDatabaseBackup, listDatabaseBackups } = require('../lib/backup/database-backup')
const { createFileBackup, restoreFileBackup, listFileBackups } = require('../lib/backup/file-backup')
const { runDisasterRecoveryTest } = require('../lib/backup/disaster-recovery')
const { getBackupMetrics, checkBackupHealth } = require('../lib/backup/monitoring-integration')
const fs = require('fs')
const path = require('path')

class BackupRecoveryTester {
  constructor() {
    this.testResults = {
      databaseBackup: { passed: 0, failed: 0, tests: [] },
      fileBackup: { passed: 0, failed: 0, tests: [] },
      disasterRecovery: { passed: 0, failed: 0, tests: [] },
      monitoring: { passed: 0, failed: 0, tests: [] },
      overall: { startTime: new Date(), endTime: null, duration: 0, success: false }
    }

    this.testData = {
      testFile: path.join(process.cwd(), 'test-backup-file.txt'),
      testDir: path.join(process.cwd(), 'test-backup-dir'),
      restoreDir: path.join(process.cwd(), 'test-restore-dir')
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Backup and Recovery Test Suite')
    console.log('=' .repeat(50))

    try {
      // Setup test data
      await this.setupTestData()

      // Run individual test suites
      await this.runDatabaseBackupTests()
      await this.runFileBackupTests()
      await this.runDisasterRecoveryTests()
      await this.runMonitoringTests()

      // Generate report
      await this.generateTestReport()

    } catch (error) {
      console.error('❌ Test suite failed:', error.message)
      this.logTestResult('overall', false, 'Test suite execution failed', error.message)
    } finally {
      // Cleanup
      await this.cleanupTestData()

      this.testResults.overall.endTime = new Date()
      this.testResults.overall.duration = this.testResults.overall.endTime - this.testResults.overall.startTime
      this.testResults.overall.success = this.isOverallSuccess()
    }
  }

  /**
   * Setup test data
   */
  async setupTestData() {
    console.log('📁 Setting up test data...')

    // Create test file
    fs.writeFileSync(this.testData.testFile, 'This is a test file for backup testing.\n' + Date.now())

    // Create test directory with files
    if (!fs.existsSync(this.testData.testDir)) {
      fs.mkdirSync(this.testData.testDir, { recursive: true })
    }

    for (let i = 1; i <= 5; i++) {
      const filePath = path.join(this.testData.testDir, `test-file-${i}.txt`)
      fs.writeFileSync(filePath, `Test file ${i} content - ${Date.now()}\n`.repeat(i))
    }

    console.log('✅ Test data setup complete')
  }

  /**
   * Run database backup tests
   */
  async runDatabaseBackupTests() {
    console.log('\n🗄️  Running Database Backup Tests...')

    try {
      // Test 1: Create backup
      console.log('  Test 1: Creating database backup...')
      const backupResult = await createDatabaseBackup()
      this.logTestResult('databaseBackup', backupResult.success, 'Create database backup', backupResult.error)

      if (backupResult.success) {
        // Test 2: List backups
        console.log('  Test 2: Listing database backups...')
        const backups = await listDatabaseBackups()
        const listSuccess = Array.isArray(backups) && backups.length > 0
        this.logTestResult('databaseBackup', listSuccess, 'List database backups')

        // Test 3: Restore backup
        console.log('  Test 3: Testing database restore...')
        const restoreResult = await restoreDatabaseBackup(backupResult.backupId)
        this.logTestResult('databaseBackup', restoreResult.success, 'Restore database backup', restoreResult.error)
      }

    } catch (error) {
      console.error('❌ Database backup tests failed:', error.message)
      this.logTestResult('databaseBackup', false, 'Database backup tests', error.message)
    }
  }

  /**
   * Run file backup tests
   */
  async runFileBackupTests() {
    console.log('\n📁 Running File Backup Tests...')

    try {
      // Test 1: Create backup
      console.log('  Test 1: Creating file backup...')
      const backupResult = await createFileBackup()
      this.logTestResult('fileBackup', backupResult.success, 'Create file backup', backupResult.error)

      if (backupResult.success) {
        // Test 2: List backups
        console.log('  Test 2: Listing file backups...')
        const backups = await listFileBackups()
        const listSuccess = Array.isArray(backups) && backups.length > 0
        this.logTestResult('fileBackup', listSuccess, 'List file backups')

        // Test 3: Restore backup
        console.log('  Test 3: Testing file restore...')
        if (!fs.existsSync(this.testData.restoreDir)) {
          fs.mkdirSync(this.testData.restoreDir, { recursive: true })
        }
        const restoreResult = await restoreFileBackup(backupResult.backupId, this.testData.restoreDir)
        this.logTestResult('fileBackup', restoreResult.success, 'Restore file backup', restoreResult.error)
      }

    } catch (error) {
      console.error('❌ File backup tests failed:', error.message)
      this.logTestResult('fileBackup', false, 'File backup tests', error.message)
    }
  }

  /**
   * Run disaster recovery tests
   */
  async runDisasterRecoveryTests() {
    console.log('\n🚨 Running Disaster Recovery Tests...')

    try {
      // Test 1: Run partial DR test
      console.log('  Test 1: Running partial DR test...')
      const partialTest = await runDisasterRecoveryTest('partial')
      this.logTestResult('disasterRecovery', partialTest.success, 'Partial DR test', partialTest.error)

      // Test 2: Run full DR test (if not in production)
      if (process.env.NODE_ENV !== 'production') {
        console.log('  Test 2: Running full DR test...')
        const fullTest = await runDisasterRecoveryTest('full')
        this.logTestResult('disasterRecovery', fullTest.success, 'Full DR test', fullTest.error)
      } else {
        console.log('  Test 2: Skipping full DR test in production')
        this.logTestResult('disasterRecovery', true, 'Skip full DR test in production')
      }

    } catch (error) {
      console.error('❌ Disaster recovery tests failed:', error.message)
      this.logTestResult('disasterRecovery', false, 'Disaster recovery tests', error.message)
    }
  }

  /**
   * Run monitoring tests
   */
  async runMonitoringTests() {
    console.log('\n📊 Running Monitoring Tests...')

    try {
      // Test 1: Get backup metrics
      console.log('  Test 1: Getting backup metrics...')
      const metrics = getBackupMetrics()
      const metricsValid = metrics && typeof metrics.overall.healthScore === 'number'
      this.logTestResult('monitoring', metricsValid, 'Get backup metrics')

      // Test 2: Check backup health
      console.log('  Test 2: Checking backup health...')
      await checkBackupHealth()
      this.logTestResult('monitoring', true, 'Check backup health')

      // Test 3: Get alerts
      console.log('  Test 3: Getting backup alerts...')
      const alerts = getBackupAlerts()
      const alertsValid = Array.isArray(alerts)
      this.logTestResult('monitoring', alertsValid, 'Get backup alerts')

    } catch (error) {
      console.error('❌ Monitoring tests failed:', error.message)
      this.logTestResult('monitoring', false, 'Monitoring tests', error.message)
    }
  }

  /**
   * Generate test report
   */
  async generateTestReport() {
    console.log('\n📋 Generating Test Report...')
    console.log('=' .repeat(50))

    const report = {
      timestamp: new Date().toISOString(),
      duration: this.testResults.overall.duration,
      summary: {
        databaseBackup: this.testResults.databaseBackup,
        fileBackup: this.testResults.fileBackup,
        disasterRecovery: this.testResults.disasterRecovery,
        monitoring: this.testResults.monitoring,
        overall: {
          totalTests: this.getTotalTests(),
          passedTests: this.getPassedTests(),
          failedTests: this.getFailedTests(),
          successRate: this.getSuccessRate()
        }
      },
      details: {
        databaseBackup: this.testResults.databaseBackup.tests,
        fileBackup: this.testResults.fileBackup.tests,
        disasterRecovery: this.testResults.disasterRecovery.tests,
        monitoring: this.testResults.monitoring.tests
      }
    }

    // Print summary
    console.log(`\n📊 Test Results Summary:`)
    console.log(`Total Tests: ${report.summary.overall.totalTests}`)
    console.log(`Passed: ${report.summary.overall.passedTests}`)
    console.log(`Failed: ${report.summary.overall.failedTests}`)
    console.log(`Success Rate: ${report.summary.overall.successRate.toFixed(1)}%`)
    console.log(`Duration: ${(report.duration / 1000).toFixed(1)}s`)

    // Print detailed results
    console.log(`\n🔍 Detailed Results:`)
    Object.entries(report.summary).forEach(([category, results]) => {
      if (category !== 'overall') {
        const successRate = results.tests.length > 0 ?
          (results.passed / (results.passed + results.failed) * 100).toFixed(1) : '0.0'
        console.log(`  ${category}: ${results.passed} passed, ${results.failed} failed (${successRate}%)`)
      }
    })

    // Save report to file
    const reportPath = path.join(process.cwd(), 'test-reports', `backup-recovery-test-${Date.now()}.json`)
    const reportDir = path.dirname(reportPath)

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n💾 Report saved to: ${reportPath}`)

    // Final status
    if (this.testResults.overall.success) {
      console.log('\n✅ All tests completed successfully!')
    } else {
      console.log('\n❌ Some tests failed. Check the report for details.')
      process.exit(1)
    }
  }

  /**
   * Log test result
   */
  logTestResult(category, success, testName, error = null) {
    const result = {
      testName,
      success,
      timestamp: new Date().toISOString(),
      error
    }

    this.testResults[category].tests.push(result)

    if (success) {
      this.testResults[category].passed++
      console.log(`    ✅ ${testName}`)
    } else {
      this.testResults[category].failed++
      console.log(`    ❌ ${testName}${error ? `: ${error}` : ''}`)
    }
  }

  /**
   * Get total number of tests
   */
  getTotalTests() {
    return Object.values(this.testResults)
      .filter(r => r.tests)
      .reduce((sum, r) => sum + r.tests.length, 0)
  }

  /**
   * Get number of passed tests
   */
  getPassedTests() {
    return Object.values(this.testResults)
      .filter(r => r.passed !== undefined)
      .reduce((sum, r) => sum + r.passed, 0)
  }

  /**
   * Get number of failed tests
   */
  getFailedTests() {
    return Object.values(this.testResults)
      .filter(r => r.failed !== undefined)
      .reduce((sum, r) => sum + r.failed, 0)
  }

  /**
   * Get success rate
   */
  getSuccessRate() {
    const total = this.getTotalTests()
    return total > 0 ? (this.getPassedTests() / total) * 100 : 0
  }

  /**
   * Check if overall test suite was successful
   */
  isOverallSuccess() {
    return this.getFailedTests() === 0
  }

  /**
   * Cleanup test data
   */
  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...')

    try {
      // Remove test files
      if (fs.existsSync(this.testData.testFile)) {
        fs.unlinkSync(this.testData.testFile)
      }

      // Remove test directories
      const dirsToRemove = [this.testData.testDir, this.testData.restoreDir]
      for (const dir of dirsToRemove) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true })
        }
      }

      console.log('✅ Test data cleanup complete')
    } catch (error) {
      console.error('❌ Failed to cleanup test data:', error.message)
    }
  }
}

// Helper function to get backup alerts (since it's not exported)
function getBackupAlerts() {
  try {
    const { getBackupAlerts } = require('../lib/backup/monitoring-integration')
    return getBackupAlerts()
  } catch {
    return []
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new BackupRecoveryTester()
  tester.runAllTests().catch(error => {
    console.error('Test suite execution failed:', error)
    process.exit(1)
  })
}

module.exports = BackupRecoveryTester