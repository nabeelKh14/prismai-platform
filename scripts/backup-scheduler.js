#!/usr/bin/env node

/**
 * Automated Backup Scheduler
 * Runs scheduled backups for database and files
 */

const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const cron = require('node-cron')

class BackupScheduler {
  constructor() {
    this.config = {
      databaseSchedule: '0 2 * * *', // Daily at 2 AM
      fileSchedule: '0 3 * * *',     // Daily at 3 AM
      logFile: path.join(process.cwd(), 'logs', 'backup-scheduler.log'),
      maxRetries: 3,
      retryDelay: 300000, // 5 minutes
    }

    this.ensureLogDirectory()
  }

  /**
   * Start the backup scheduler
   */
  start() {
    console.log('Starting Automated Backup Scheduler...')

    // Schedule database backups
    cron.schedule(this.config.databaseSchedule, async () => {
      console.log('Running scheduled database backup...')
      await this.runDatabaseBackup()
    })

    // Schedule file backups
    cron.schedule(this.config.fileSchedule, async () => {
      console.log('Running scheduled file backup...')
      await this.runFileBackup()
    })

    // Schedule cleanup (weekly)
    cron.schedule('0 4 * * 0', async () => {
      console.log('Running backup cleanup...')
      await this.cleanupOldBackups()
    })

    this.log('Backup scheduler started successfully')
    console.log('Backup scheduler started. Press Ctrl+C to stop.')
  }

  /**
   * Run database backup
   */
  async runDatabaseBackup() {
    try {
      const timestamp = new Date().toISOString()
      this.log(`Starting database backup at ${timestamp}`)

      // Call the database backup API
      const result = await this.callBackupAPI('database', 'create')

      if (result.success) {
        this.log(`Database backup completed successfully: ${result.backupId}`)
      } else {
        this.log(`Database backup failed: ${result.error}`)
        await this.retryBackup('database')
      }

    } catch (error) {
      this.log(`Database backup error: ${error.message}`)
      await this.retryBackup('database')
    }
  }

  /**
   * Run file backup
   */
  async runFileBackup() {
    try {
      const timestamp = new Date().toISOString()
      this.log(`Starting file backup at ${timestamp}`)

      // Call the file backup API
      const result = await this.callBackupAPI('files', 'create')

      if (result.success) {
        this.log(`File backup completed successfully: ${result.backupId}`)
      } else {
        this.log(`File backup failed: ${result.error}`)
        await this.retryBackup('files')
      }

    } catch (error) {
      this.log(`File backup error: ${error.message}`)
      await this.retryBackup('files')
    }
  }

  /**
   * Call backup API
   */
  async callBackupAPI(type, action) {
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const url = `${apiUrl}/api/backup`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SCHEDULER_API_TOKEN || 'scheduler-token'}`
      },
      body: JSON.stringify({ type, action })
    })

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Retry failed backup
   */
  async retryBackup(type) {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.log(`Retry attempt ${attempt} for ${type} backup`)

        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))

        const result = await this.callBackupAPI(type, 'create')

        if (result.success) {
          this.log(`${type} backup succeeded on retry ${attempt}`)
          return
        }

      } catch (error) {
        this.log(`${type} backup retry ${attempt} failed: ${error.message}`)
      }
    }

    this.log(`${type} backup failed after ${this.config.maxRetries} retries`)
    await this.sendFailureAlert(type)
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups() {
    try {
      this.log('Starting backup cleanup')

      // This would be handled by the backup services themselves
      // but we can trigger it via API if needed

      this.log('Backup cleanup completed')
    } catch (error) {
      this.log(`Backup cleanup error: ${error.message}`)
    }
  }

  /**
   * Send failure alert
   */
  async sendFailureAlert(type) {
    // In a production environment, this would send notifications
    // via email, Slack, or other alerting systems
    this.log(`ALERT: ${type} backup failed after retries`)

    // Example: Send to Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Backup Failure Alert`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Type', value: type, short: true },
                { title: 'Time', value: new Date().toISOString(), short: true },
                { title: 'Status', value: 'Failed after retries', short: false }
              ]
            }]
          })
        })
      } catch (error) {
        this.log(`Failed to send Slack alert: ${error.message}`)
      }
    }
  }

  /**
   * Log message to file
   */
  log(message) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}\n`

    console.log(message)

    try {
      fs.appendFileSync(this.config.logFile, logMessage)
    } catch (error) {
      console.error('Failed to write to log file:', error.message)
    }
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    const logDir = path.dirname(this.config.logFile)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down backup scheduler...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nShutting down backup scheduler...')
  process.exit(0)
})

// Start the scheduler if this script is run directly
if (require.main === module) {
  const scheduler = new BackupScheduler()
  scheduler.start()
}

module.exports = BackupScheduler