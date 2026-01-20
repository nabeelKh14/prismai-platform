# Supabase Google OAuth Setup Guide

## Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if prompted:
   - User Type: External
   - App name: Your app name
   - User support email: Your email
   - Developer contact: Your email
6. For Application type, select **Web application**
7. Add **Authorized redirect URIs**:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
   (Replace `your-project-id` with your actual Supabase project ID)
8. Click **Create**
9. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Sign in with Google** to ON
6. Paste your Google **Client ID**
7. Paste your Google **Client Secret**
8. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/callback
   https://your-production-domain.com/auth/callback
   ```
9. Click **Save**

## Step 3: Update Environment Variables

1. Open your `.env.local` file
2. Ensure these variables are set correctly:
   ```env
   # Get these from Supabase Dashboard → Project Settings → API
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## Step 4: Test the Setup

1. Restart your Next.js dev server
2. Navigate to `http://localhost:3000/auth/sign-up`
3. Click "Continue with Google"
4. You should be redirected to Google's OAuth consent screen
5. After authorization, you'll be redirected back to your app

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Make sure the redirect URI in Google Cloud Console exactly matches: `https://your-project-id.supabase.co/auth/v1/callback`

### Error: "Invalid OAuth client"
- Double-check that Client ID and Client Secret are correctly copied to Supabase

### Error: "localhost refused to connect"
- Verify `NEXT_PUBLIC_SUPABASE_URL` is set to your cloud Supabase URL (not localhost:54321)

## Quick Checklist

- [ ] Google OAuth Client ID created
- [ ] Google OAuth Client Secret created
- [ ] Redirect URI added to Google Cloud Console
- [ ] Google provider enabled in Supabase
- [ ] Client ID and Secret added to Supabase
- [ ] Environment variables updated in `.env.local`
- [ ] Dev server restarted
