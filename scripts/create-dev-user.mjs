/**
 * Simple script to create a development test user
 * Run with: node scripts/create-dev-user.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables!')
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

const devEmail = 'dev@test.com'
const devPassword = 'DevPassword123!'

console.log('🔧 Creating development user...')
console.log('Email:', devEmail)
console.log('Password:', devPassword)

const { data, error } = await supabase.auth.admin.createUser({
    email: devEmail,
    password: devPassword,
    email_confirm: true,
    user_metadata: {
        first_name: 'Dev',
        last_name: 'User',
    }
})

if (error) {
    console.error('❌ Error creating user:', error.message)
    process.exit(1)
}

console.log('\n✅ User created successfully!')
console.log('User ID:', data.user.id)
console.log('\n📝 Login Credentials:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Email:    ', devEmail)
console.log('Password: ', devPassword)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\n🌐 Login at: http://localhost:3000/auth/login')
