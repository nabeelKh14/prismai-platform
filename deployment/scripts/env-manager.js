#!/usr/bin/env node

/**
 * Environment Configuration Manager
 * Manages environment-specific configurations for PrismAI deployment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnvironmentManager {
  constructor() {
    this.envDir = path.join(__dirname, '..', 'environments');
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.secretsDir = path.join(__dirname, '..', 'secrets');
  }

  /**
   * Initialize environment manager
   */
  async initialize() {
    // Create directories if they don't exist
    [this.envDir, this.templatesDir, this.secretsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    console.log('✅ Environment Manager initialized');
  }

  /**
   * Validate environment configuration
   */
  async validateEnvironment(envName) {
    const envFile = path.join(this.envDir, `${envName}.env`);

    if (!fs.existsSync(envFile)) {
      throw new Error(`Environment file not found: ${envFile}`);
    }

    const config = this.parseEnvFile(envFile);
    const errors = [];

    // Required environment variables
    const required = [
      'NODE_ENV',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GEMINI_API_KEY',
      'JWT_SECRET',
      'ENCRYPTION_KEY'
    ];

    required.forEach(key => {
      if (!config[key]) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    });

    // Validate URLs
    const urlKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_APP_URL'];
    urlKeys.forEach(key => {
      if (config[key] && !this.isValidUrl(config[key])) {
        errors.push(`Invalid URL format for ${key}: ${config[key]}`);
      }
    });

    // Validate JWT secret length
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }

    // Validate encryption key length
    if (config.ENCRYPTION_KEY && config.ENCRYPTION_KEY.length !== 32) {
      errors.push('ENCRYPTION_KEY must be exactly 32 characters long');
    }

    if (errors.length > 0) {
      console.error('❌ Environment validation failed:');
      errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Environment validation failed');
    }

    console.log(`✅ Environment ${envName} validation passed`);
    return true;
  }

  /**
   * Parse environment file
   */
  parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = {};

    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        config[key.trim()] = valueParts.join('=').trim();
      }
    });

    return config;
  }

  /**
   * Generate secure secrets
   */
  generateSecrets() {
    const secrets = {
      JWT_SECRET: crypto.randomBytes(64).toString('hex'),
      ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
      WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
      HEALTH_CHECK_TOKEN: crypto.randomBytes(16).toString('hex'),
      API_SECRET_KEY: crypto.randomBytes(32).toString('hex')
    };

    console.log('🔐 Generated secure secrets:');
    Object.entries(secrets).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    return secrets;
  }

  /**
   * Create environment template
   */
  async createEnvironmentTemplate(envName, baseEnv = 'production') {
    const baseFile = path.join(this.envDir, `${baseEnv}.env`);
    const templateFile = path.join(this.templatesDir, `${envName}.env.template`);

    if (!fs.existsSync(baseFile)) {
      throw new Error(`Base environment file not found: ${baseFile}`);
    }

    // Copy base file as template
    fs.copyFileSync(baseFile, templateFile);

    // Replace sensitive values with placeholders
    let content = fs.readFileSync(templateFile, 'utf8');

    const placeholders = {
      'SUPABASE_SERVICE_ROLE_KEY': 'your_service_role_key_here',
      'GEMINI_API_KEY': 'your_gemini_api_key_here',
      'VAPI_API_KEY': 'your_vapi_api_key_here',
      'TWILIO_ACCOUNT_SID': 'your_twilio_account_sid',
      'TWILIO_AUTH_TOKEN': 'your_twilio_auth_token',
      'JWT_SECRET': 'your_jwt_secret_minimum_32_characters',
      'ENCRYPTION_KEY': 'your_encryption_key_32_characters',
      'WEBHOOK_SECRET': 'your_webhook_secret',
      'HEALTH_CHECK_TOKEN': 'your_health_check_token'
    };

    Object.entries(placeholders).forEach(([key, placeholder]) => {
      const regex = new RegExp(`${key}=.*`, 'g');
      content = content.replace(regex, `${key}=${placeholder}`);
    });

    fs.writeFileSync(templateFile, content);

    console.log(`✅ Created environment template: ${templateFile}`);
    return templateFile;
  }

  /**
   * Deploy environment configuration
   */
  async deployEnvironment(envName, targetPath) {
    await this.validateEnvironment(envName);

    const envFile = path.join(this.envDir, `${envName}.env`);
    const targetFile = path.join(targetPath, '.env');

    // Ensure target directory exists
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Copy environment file
    fs.copyFileSync(envFile, targetFile);

    // Set appropriate permissions
    fs.chmodSync(targetFile, 0o600);

    console.log(`✅ Deployed ${envName} environment to ${targetFile}`);
    return targetFile;
  }

  /**
   * Compare environments
   */
  async compareEnvironments(env1, env2) {
    const config1 = this.parseEnvFile(path.join(this.envDir, `${env1}.env`));
    const config2 = this.parseEnvFile(path.join(this.envDir, `${env2}.env`));

    const differences = {
      onlyInEnv1: [],
      onlyInEnv2: [],
      different: []
    };

    // Find keys only in env1
    Object.keys(config1).forEach(key => {
      if (!(key in config2)) {
        differences.onlyInEnv1.push(key);
      } else if (config1[key] !== config2[key]) {
        differences.different.push(key);
      }
    });

    // Find keys only in env2
    Object.keys(config2).forEach(key => {
      if (!(key in config1)) {
        differences.onlyInEnv2.push(key);
      }
    });

    console.log(`🔍 Environment comparison: ${env1} vs ${env2}`);
    console.log(`  Keys only in ${env1}: ${differences.onlyInEnv1.length}`);
    console.log(`  Keys only in ${env2}: ${differences.onlyInEnv2.length}`);
    console.log(`  Different values: ${differences.different.length}`);

    return differences;
  }

  /**
   * Backup environment configuration
   */
  async backupEnvironment(envName, backupDir = null) {
    const envFile = path.join(this.envDir, `${envName}.env`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDirPath = backupDir || path.join(this.envDir, 'backups');

    if (!fs.existsSync(backupDirPath)) {
      fs.mkdirSync(backupDirPath, { recursive: true });
    }

    const backupFile = path.join(backupDirPath, `${envName}-${timestamp}.env.backup`);

    fs.copyFileSync(envFile, backupFile);

    console.log(`✅ Backed up ${envName} environment to ${backupFile}`);
    return backupFile;
  }

  /**
   * Validate URL format
   */
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * List available environments
   */
  listEnvironments() {
    if (!fs.existsSync(this.envDir)) {
      return [];
    }

    return fs.readdirSync(this.envDir)
      .filter(file => file.endsWith('.env'))
      .map(file => file.replace('.env', ''));
  }

  /**
   * Get environment info
   */
  async getEnvironmentInfo(envName) {
    const envFile = path.join(this.envDir, `${envName}.env`);

    if (!fs.existsSync(envFile)) {
      throw new Error(`Environment file not found: ${envFile}`);
    }

    const stats = fs.statSync(envFile);
    const config = this.parseEnvFile(envFile);

    return {
      name: envName,
      file: envFile,
      size: stats.size,
      modified: stats.mtime,
      variables: Object.keys(config).length,
      nodeEnv: config.NODE_ENV || 'unknown'
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new EnvironmentManager();
  await manager.initialize();

  try {
    switch (command) {
      case 'validate':
        const envName = args[1] || 'production';
        await manager.validateEnvironment(envName);
        break;

      case 'generate-secrets':
        manager.generateSecrets();
        break;

      case 'create-template':
        const templateEnv = args[1] || 'production';
        const newEnv = args[2] || 'development';
        await manager.createEnvironmentTemplate(newEnv, templateEnv);
        break;

      case 'deploy':
        const deployEnv = args[1] || 'production';
        const deployPath = args[2] || process.cwd();
        await manager.deployEnvironment(deployEnv, deployPath);
        break;

      case 'compare':
        const env1 = args[1] || 'staging';
        const env2 = args[2] || 'production';
        await manager.compareEnvironments(env1, env2);
        break;

      case 'backup':
        const backupEnv = args[1] || 'production';
        await manager.backupEnvironment(backupEnv);
        break;

      case 'list':
        const environments = manager.listEnvironments();
        console.log('📋 Available environments:');
        environments.forEach(env => console.log(`  - ${env}`));
        break;

      case 'info':
        const infoEnv = args[1] || 'production';
        const info = await manager.getEnvironmentInfo(infoEnv);
        console.log('ℹ️  Environment Information:');
        console.log(`  Name: ${info.name}`);
        console.log(`  File: ${info.file}`);
        console.log(`  Size: ${info.size} bytes`);
        console.log(`  Modified: ${info.modified}`);
        console.log(`  Variables: ${info.variables}`);
        console.log(`  Node Environment: ${info.nodeEnv}`);
        break;

      default:
        console.log(`
🔧 Environment Manager - PrismAI

Usage:
  node env-manager.js <command> [options]

Commands:
  validate [env]          - Validate environment configuration
  generate-secrets        - Generate secure secrets
  create-template [base] [new] - Create environment template
  deploy [env] [path]     - Deploy environment to target path
  compare [env1] [env2]   - Compare two environments
  backup [env]           - Backup environment configuration
  list                   - List available environments
  info [env]             - Show environment information

Examples:
  node env-manager.js validate production
  node env-manager.js generate-secrets
  node env-manager.js deploy staging /app
  node env-manager.js compare staging production
        `);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = EnvironmentManager;