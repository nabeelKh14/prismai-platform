#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

async function createLoggingTables() {
  console.log('🚀 Creating logging tables...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '010_comprehensive_logging_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.warn(`⚠️  Statement ${i + 1} warning:`, error.message);
          }
        } catch (err) {
          console.warn(`⚠️  Statement ${i + 1} failed:`, err.message);
        }
      }
    }

    console.log('✅ Logging tables creation completed!');
    console.log('🔍 Verifying tables...');

    // Verify tables were created
    const { data: tables, error: listError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['system_logs', 'audit_trails']);

    if (listError) {
      console.warn('⚠️  Could not verify tables:', listError.message);
    } else {
      const tableNames = tables?.map(t => t.table_name) || [];
      console.log('📋 Found tables:', tableNames.join(', '));

      if (tableNames.includes('system_logs') && tableNames.includes('audit_trails')) {
        console.log('✅ All logging tables created successfully!');
      } else {
        console.log('⚠️  Some tables may not have been created');
      }
    }

  } catch (error) {
    console.error('❌ Failed to create logging tables:', error.message);
    process.exit(1);
  }
}

createLoggingTables();