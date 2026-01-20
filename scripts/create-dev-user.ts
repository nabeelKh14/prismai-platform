/**
 * Script to create a development test user
 * Run with: npx tsx scripts/create-dev-user.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function createDevUser() {
    const devEmail = 'dev@test.com'
    const devPassword = 'DevPassword123!'

    console.log('Creating development user...')
    console.log('Email:', devEmail)
    console.log('Password:', devPassword)

    try {
        // Create the user
        const { data, error } = await supabase.auth.admin.createUser({
            email: devEmail,
            password: devPassword,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                first_name: 'Dev',
                last_name: 'User',
            }
        })

        if (error) {
            console.error('Error creating user:', error.message)
            return
        }

        console.log('✅ User created successfully!')
        console.log('User ID:', data.user.id)
        console.log('\n📝 Login Credentials:')
        console.log('Email:', devEmail)
        console.log('Password:', devPassword)
        console.log('\nYou can now login at: http://localhost:3000/auth/login')

    } catch (err) {
        console.error('Unexpected error:', err)
    }
}

createDevUser()
