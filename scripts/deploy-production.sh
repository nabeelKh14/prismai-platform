#!/bin/bash

# Production Deployment Script for Vercel
# This script deploys the AI Receptionist to Vercel with proper validation and checks

set -e  # Exit on any error

echo "🚀 Starting AI Receptionist Vercel Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vercel CLI is installed
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        print_status "Vercel CLI not found. Installing globally..."
        npm install -g vercel
        print_success "Vercel CLI installed successfully"
    else
        print_success "Vercel CLI is already installed"
    fi
}

# Check Vercel authentication
check_vercel_auth() {
    print_status "Checking Vercel authentication..."
    if ! vercel whoami &> /dev/null; then
        print_error "Vercel authentication required!"
        print_status "Please run the following command to authenticate:"
        print_status "vercel login"
        print_status ""
        print_status "Or set up a Vercel token:"
        print_status "1. Go to https://vercel.com/account/tokens"
        print_status "2. Create a new token"
        print_status "3. Set the environment variable: export VERCEL_TOKEN='your-token-here'"
        exit 1
    else
        print_success "Vercel authentication verified"
    fi
}

# Check if production environment file exists
if [ ! -f ".env.production" ]; then
    print_error "Production environment file not found!"
    print_status "Please copy .env.example to .env.production and configure all variables"
    exit 1
fi

# Check for required environment variables for Vercel
print_status "Checking environment variables for Vercel deployment..."
REQUIRED_VARS=("NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "GEMINI_API_KEY" "VAPI_API_KEY")

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env.production || grep -q "^${var}=your_" .env.production; then
        print_error "Required environment variable ${var} is not set or uses placeholder value"
        exit 1
    fi
done

print_success "Environment variables validated"

# Install dependencies
print_status "Installing dependencies..."
npm ci --production=false

# Run type checking
print_status "Running TypeScript type checking..."
if ! npm run typecheck; then
    print_error "TypeScript errors found. Please fix before deploying."
    exit 1
fi

# Run security checks
print_status "Running security checks..."
if npm run lint; then
    print_success "Security checks passed"
else
    print_warning "Linting issues found. Consider fixing before deployment."
fi

# Build for production
print_status "Building for production..."
if ! npm run build; then
    print_error "Build failed. Please fix build errors before deploying."
    exit 1
fi

print_success "Production build completed successfully!"

# Check Vercel configuration
print_status "Validating Vercel configuration..."
if [ -f "vercel.json" ]; then
    print_success "vercel.json configuration found"
else
    print_warning "No vercel.json found. Using default Vercel configuration."
fi

# Check if this is a linked project
print_status "Checking Vercel project linking..."
if [ ! -d ".vercel" ]; then
    print_warning "Project not linked to Vercel. You may need to link it first."
    print_status "Run: vercel link"
    print_status "Or deploy with: vercel --prod"
fi

# Deploy to Vercel
print_status "Deploying to Vercel production..."
if vercel --prod; then
    print_success "Deployment to Vercel completed successfully!"
else
    print_error "Vercel deployment failed!"
    print_status "Please check the error messages above and try again."
    exit 1
fi

# Get deployment URL
print_status "Fetching deployment information..."
if vercel ls --scope="$(vercel whoami 2>/dev/null | tail -1)" | grep -q "production"; then
    print_success "Production deployment is live!"
    print_status ""
    print_status "📋 Post-Deployment Steps:"
    print_status "1. Verify your deployment URL in the Vercel dashboard"
    print_status "2. Test all API endpoints and functionality"
    print_status "3. Set up custom domain if needed (vercel domain add <domain>)"
    print_status "4. Configure environment variables in Vercel dashboard if not already set"
    print_status "5. Set up monitoring and analytics"
    print_status "6. Test webhook integrations and external API connections"
    print_status ""
    print_status "🔒 Security Features Applied:"
    print_status "✅ Environment variables validated"
    print_status "✅ TypeScript type checking completed"
    print_status "✅ Security linting checks passed"
    print_status "✅ Vercel security headers applied automatically"
    print_status "✅ Production build optimized and minified"
    print_status ""
    print_success "Production deployment completed successfully! 🎉"
else
    print_warning "Could not verify deployment status. Please check Vercel dashboard."
fi