'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'
import { Chrome } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import DotGrid from '@/components/DotGrid'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const mountedRef = useRef(true)

  // Environment variable validation and Supabase client creation
  const [supabase, setSupabase] = useState<any>(null)
  const [envError, setEnvError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const client = createClient()
      setSupabase(client)
    } catch (error) {
      setEnvError('Environment configuration error. Please check your setup.')
    }

    return () => {
      mountedRef.current = false
    }
  }, [])

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginForm) => {
    if (!supabase || !mountedRef.current) return

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        if (mountedRef.current) {
          toast({
            title: 'Login Failed',
            description: error.message,
            variant: 'destructive',
          })
        }
      } else {
        // Validate authentication state before navigation
        const { data: session } = await supabase.auth.getSession()
        if (session?.session && mountedRef.current) {
          toast({
            title: 'Login Successful',
            description: 'Welcome back!',
          })
          router.push('/dashboard')
        } else if (mountedRef.current) {
          toast({
            title: 'Authentication Error',
            description: 'Failed to verify authentication. Please try again.',
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      if (mountedRef.current) {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  const handleGoogleSignIn = async () => {
    if (!supabase || !mountedRef.current || typeof window === 'undefined') return

    setIsGoogleLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error && mountedRef.current) {
        toast({
          title: 'Google Sign In Failed',
          description: error.message,
          variant: 'destructive',
        })
      }
    } catch (error) {
      if (mountedRef.current) {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      if (mountedRef.current) {
        setIsGoogleLoading(false)
      }
    }
  }

  // Show environment error if Supabase client couldn't be created
  if (envError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border-white/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-white">Configuration Error</CardTitle>
            <CardDescription className="text-center text-gray-400">
              {envError}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      {/* Interactive dot-grid background */}
      <DotGrid
        dotSize={2}
        gap={24}
        baseColor="#00ffff"
        activeColor="#ffffff"
        proximity={120}
        speedTrigger={50}
        shockRadius={200}
        shockStrength={3}
        className="fixed inset-0 z-0"
        style={{ opacity: 0.6 }}
      />

      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-pink-500/8 opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-pink-500/8" />

      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border-white/10 shadow-lg relative z-10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-white">Sign In</CardTitle>
          <CardDescription className="text-center text-gray-400">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full bg-white/5 backdrop-blur-xl border-white/10 hover:bg-white/10 text-white"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading || !supabase}
          >
            <Chrome className="mr-2 h-4 w-4" />
            {isGoogleLoading ? 'Signing In...' : 'Continue with Google'}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-950 px-2 text-gray-400">Or continue with</span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                        {...field}
                        disabled={isLoading || isGoogleLoading || !supabase}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                        {...field}
                        disabled={isLoading || isGoogleLoading || !supabase}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-gradient-to-r from-cyan-400 to-pink-400 hover:from-cyan-500 hover:to-pink-500 text-white shadow-lg" disabled={isLoading || isGoogleLoading || !supabase}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Link
                href="/auth/sign-up"
                className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
