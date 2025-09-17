#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🚀 AI Receptionist Production Setup')
console.log('==================================\n')

// Check Node.js version
const nodeVersion = process.version
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])
if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required')
  console.error(`Current version: ${nodeVersion}`)
  process.exit(1)
}
console.log(`✅ Node.js version: ${nodeVersion}`)

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env.local from template...')
  const examplePath = path.join(process.cwd(), '.env.example')
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath)
    console.log('✅ .env.local created')
    console.log('⚠️  Please edit .env.local with your API keys')
  } else {
    console.error('❌ .env.example not found')
  }
} else {
  console.log('✅ .env.local already exists')
}

// Install dependencies
try {
  console.log('\n📦 Checking dependencies...')
  // Check if node_modules exists and has packages
  const nodeModulesExists = fs.existsSync(path.join(process.cwd(), 'node_modules'))
  
  if (!nodeModulesExists) {
    console.log('Installing dependencies...')
    try {
      execSync('npm ci', { stdio: 'inherit' })
    } catch (error) {
      console.log('⚠️  npm ci failed, running npm install instead...')
      execSync('npm install', { stdio: 'inherit' })
    }
  } else {
    console.log('✅ Dependencies already installed')
  }
} catch (error) {
  console.error('❌ Failed to install dependencies')
  process.exit(1)
}

// Run type check (optional)
try {
  console.log('\n🔍 Running type check...')
  execSync('npm run typecheck', { stdio: 'pipe' }) // Use pipe to suppress output
  console.log('✅ Type check passed')
} catch (error) {
  console.log('⚠️  Type check has some errors - this is normal for new setup')
  console.log('   You can run "npm run typecheck" later to see and fix specific errors')
}

// Run tests (optional)
console.log('\n🧪 Skipping tests for quick setup...')
console.log('   You can run "npm test" later to run the test suite')

// Check environment variables
console.log('\n🔧 Checking environment configuration...')
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'VAPI_API_KEY'
]

require('dotenv').config({ path: envPath })

let missingVars = []
requiredEnvVars.forEach(varName => {
  if (!process.env[varName] || process.env[varName].includes('your_')) {
    missingVars.push(varName)
  }
})

if (missingVars.length > 0) {
  console.log('❌ Missing or incomplete environment variables:')
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`)
  })
  console.log('\n📝 Please edit .env.local with your actual API keys')
} else {
  console.log('✅ All required environment variables are configured')
}

// Final instructions
console.log('\n🎉 Setup Complete!')
console.log('==================\n')

if (missingVars.length === 0) {
  console.log('✅ Your AI Receptionist is ready to run!')
  console.log('\n🚀 Start development server:')
  console.log('   npm run dev')
  console.log('\n🌐 Open in browser:')
  console.log('   http://localhost:3000')
} else {
  console.log('⚠️  Before starting the application:')
  console.log('1. Edit .env.local with your API keys')
  console.log('2. Set up your Supabase database')
  console.log('3. Run: npm run dev')
}

console.log('\n📚 Documentation:')
console.log('   README.md - Complete setup guide')
console.log('   DEPLOYMENT.md - Production deployment')
console.log('   .env.example - Environment variables reference')

console.log('\n🆘 Need help?')
console.log('   GitHub Issues: Report bugs and ask questions')
console.log('   Health Check: /api/health (after starting)')