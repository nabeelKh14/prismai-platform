# AI Business Suite API Testing Script for Windows PowerShell
# Make sure your server is running at http://localhost:3001

$BaseUrl = "http://localhost:3001"

Write-Host "🚀 Testing AI Business Suite APIs..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# Test 1: Health Check
Write-Host "`n1. Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method GET
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Lead Generation
Write-Host "`n2. Testing Lead Generation..." -ForegroundColor Yellow
$leadData = @{
    email = "john.doe@company.com"
    firstName = "John"
    lastName = "Doe"
    company = "Tech Innovations Inc"
    jobTitle = "CEO"
    source = "website"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/ai/leads" -Method POST -Body $leadData -ContentType "application/json"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Chatbot
Write-Host "`n3. Testing Chatbot..." -ForegroundColor Yellow
$chatData = @{
    message = "Hello, I need help with your services"
    channel = "website"
    customerIdentifier = "test-user-123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/ai/chatbot" -Method POST -Body $chatData -ContentType "application/json"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Marketing
Write-Host "`n4. Testing Marketing Automation..." -ForegroundColor Yellow
$marketingData = @{
    name = "Welcome Campaign"
    campaignType = "welcome"
    targetAudience = @{
        segments = @("new_users")
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/ai/marketing" -Method POST -Body $marketingData -ContentType "application/json"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Analytics
Write-Host "`n5. Testing Analytics..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/ai/analytics?timeframe=30d&insights=true" -Method GET
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: AI Suite
Write-Host "`n6. Testing AI Suite Orchestrator..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/ai/suite" -Method GET
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ API Testing Complete!" -ForegroundColor Green
Write-Host "Note: Some endpoints require authentication. Sign up at http://localhost:3001/auth/sign-up first." -ForegroundColor Cyan